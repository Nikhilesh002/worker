import { createMiddleware } from "langchain"
import { AIMessage, BaseMessage, SystemMessage } from "@langchain/core/messages"
import { z } from "zod"
import { groqApiKeyManager } from "./groqApiKeyManager"
import {
  createExpertModelWithKey,
  createMediumModelWithKey,
  createQwenModelWithKey,
  createRouterModelWithKey,
} from "./groqModels"
import { filterToolsByRoute } from "./toolGroups"

export const RouteSchema = z.object({
  complexity: z.enum(["simple", "medium", "complex"]),
  needsTools: z.boolean(),
  needsRetrieval: z.boolean(),
  domain: z.enum([
    "general",
    "coding",
    "math",
    "research",
    "location",
    "media",
    "debugging",
    "architecture",
    "data",
    "creative",
    "other",
  ]),
})

export type RouteDecision = z.infer<typeof RouteSchema>

export type RoutedModelTier = "primary" | "medium" | "expert"

export interface RoutedModelRequest {
  messages: BaseMessage[]
  tools: any[]
  model?: any
}

export interface RoutedModelResult {
  route: RouteDecision
  tier: RoutedModelTier
  model: ReturnType<typeof createQwenModelWithKey>["model"]
  apiKey: string
  tools: Array<{ name: string } & Record<string, unknown>>
}

const ROUTER_SYSTEM_PROMPT = `You are a semantic routing model for an AI assistant.

Analyze the user's request and the conversation context semantically. Do not use keywords or shallow pattern matching.

Return a route decision as structured JSON only.

Definitions:
- complexity:
  - simple: direct questions, short answers, light reasoning
  - medium: coding help, tool-heavy workflows, moderate reasoning, data transformation, multi-step but bounded tasks
  - complex: architecture, system design, deep debugging, ambiguous tasks, high-stakes reasoning, long multi-step analysis
- needsTools: true if external tools materially improve the answer
- needsRetrieval: true if web/search/docs/current information is required
- domain: dominant topic of the request
  - location: maps, places, weather, addresses, geolocation
  - media: video, movies, books, news, entertainment, finance/markets

Important routing preference:
- If the request is about weather, forecasts, temperature, humidity, or conditions for a place, classify it as domain="location" and prefer the weather/location tools instead of web search.

Prefer the most capable tier only when the semantic difficulty actually warrants it.`

const ROUTER_HISTORY_LIMIT = 14

function getTierForRoute(route: RouteDecision): RoutedModelTier {
  if (
    route.complexity === "complex" ||
    route.domain === "architecture" ||
    route.domain === "debugging"
  ) {
    return "expert"
  }

  if (
    route.complexity === "medium" ||
    route.needsTools ||
    route.needsRetrieval ||
    ["coding", "math", "research", "data"].includes(route.domain)
  ) {
    return "medium"
  }

  return "primary"
}

function filterTools(
  route: RouteDecision,
  tools: RoutedModelRequest["tools"],
) {
  return filterToolsByRoute(route, tools as { name: string }[])
}

function createModelForTier(tier: RoutedModelTier) {
  switch (tier) {
    case "medium": {
      return createMediumModelWithKey()
    }
    case "expert": {
      return createExpertModelWithKey()
    }
    default: {
      return createQwenModelWithKey()
    }
  }
}

function escalateTier(tier: RoutedModelTier): RoutedModelTier | null {
  if (tier === "primary") return "medium"
  if (tier === "medium") return "expert"
  return null
}

function isRetryableModelError(error: unknown) {
  const err = error as {
    status?: number
    error?: { error?: { code?: string } }
    code?: string
  }

  const code = err?.error?.error?.code || err?.code
  return err?.status === 429 || err?.status === 403 || code === "rate_limit_exceeded" || code === "model_permission_blocked_org"
}

async function classifyRoute(messages: BaseMessage[]): Promise<RouteDecision> {
  const { model, apiKey } = createRouterModelWithKey()

  try {
    const router = model.withStructuredOutput(RouteSchema)
    const route = await router.invoke([
      new SystemMessage(ROUTER_SYSTEM_PROMPT),
      ...messages.slice(-ROUTER_HISTORY_LIMIT),
    ])
    return route
  } catch (error) {
    if (isRetryableModelError(error)) {
      groqApiKeyManager.markKeyCooldown(apiKey)
    }

    return {
      complexity: "complex",
      needsTools: true,
      needsRetrieval: true,
      domain: "other",
    }
  }
}

export async function selectRoutedModel(request: RoutedModelRequest): Promise<RoutedModelResult> {
  const route = await classifyRoute(request.messages)
  const tier = getTierForRoute(route)
  const selected = createModelForTier(tier)
  const tools = filterTools(route, request.tools)

  return {
    route,
    tier,
    model: selected.model,
    apiKey: selected.apiKey,
    tools,
  }
}

export { classifyRoute }

export const dynamicModelMiddleware = createMiddleware({
  name: "DynamicModelMiddleware",
  wrapModelCall: async (request: any, handler: any) => {
    const routed = await selectRoutedModel(request)

    try {
      return await handler({
        ...request,
        model: routed.model,
        tools: routed.tools,
      })
    } catch (error) {
      if (isRetryableModelError(error)) {
        groqApiKeyManager.markKeyCooldown(routed.apiKey)
      }

      const fallbackTier = escalateTier(routed.tier)
      if (!fallbackTier) {
        throw error
      }

      const fallback = createModelForTier(fallbackTier)
      try {
        return await handler({
          ...request,
          model: fallback.model,
          tools: fallbackTier === "expert" ? request.tools : routed.tools,
        })
      } catch (fallbackError) {
        if (isRetryableModelError(fallbackError)) {
          groqApiKeyManager.markKeyCooldown(fallback.apiKey)
        }
        throw fallbackError
      }
    }
  },
})

export async function runDynamicModelCall<T extends AIMessage>(
  request: RoutedModelRequest,
  handler: (routedRequest: RoutedModelRequest) => Promise<T>,
) {
  return (dynamicModelMiddleware as any).wrapModelCall(request, handler) as Promise<T>
}
