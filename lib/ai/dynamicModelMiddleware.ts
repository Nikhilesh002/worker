import { BaseMessage, SystemMessage } from "@langchain/core/messages"
import { z } from "zod"
import { groqApiKeyManager } from "./groqApiKeyManager"
import {
  createExpertModelWithKey,
  createMediumModelWithKey,
  createQwenModelWithKey,
  createRouterModelWithKey,
} from "./groqModels"
import { ROUTER_SYSTEM_PROMPT } from "@/lib/prompts"
import {
  buildLangSmithConfig,
  type LangSmithTraceContext,
} from "@/lib/observability/langsmith"

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

export interface RoutedModelTraceContext extends LangSmithTraceContext {}

export interface RoutedModelResult {
  route: RouteDecision
  tier: RoutedModelTier
  model: ReturnType<typeof createQwenModelWithKey>["model"]
  apiKey: string
  tools: Array<{ name: string } & Record<string, unknown>>
  traceConfig: ReturnType<typeof buildLangSmithConfig>
}

const ROUTER_HISTORY_LIMIT = 8

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

async function classifyRoute(
  messages: BaseMessage[],
  traceContext?: RoutedModelTraceContext,
): Promise<RouteDecision> {
  const latestUserText = [...messages]
    .reverse()
    .find((message) => message.getType?.() === "human")
    ?.content

  const text = Array.isArray(latestUserText)
    ? latestUserText
        .map((part) => (typeof part === "string" ? part : ""))
        .join(" ")
    : typeof latestUserText === "string"
      ? latestUserText
      : ""

  if (
    /\btranslate\b|\btranslation\b|\binto english\b|\binto hindi\b|\binto spanish\b|\bfrom\s+[a-z]+\s+to\s+[a-z]+\b/i.test(
      text,
    )
  ) {
    return {
      complexity: "simple",
      needsTools: true,
      needsRetrieval: false,
      domain: "general",
    }
  }

  if (
    /\b(calculate|compute|solve|simplify|derivative|integral|what is \d[\d\s+\-*/^()]*|sqrt|factorial)\b/i.test(
      text,
    )
  ) {
    return {
      complexity: "simple",
      needsTools: true,
      needsRetrieval: false,
      domain: "math",
    }
  }

  if (
    /\b(what'?s? (the )?(date|time|day)|current (date|time)|today'?s? date|right now|what time is it)\b/i.test(
      text,
    )
  ) {
    return {
      complexity: "simple",
      needsTools: true,
      needsRetrieval: false,
      domain: "general",
    }
  }

  if (
    /\b(convert \d|how many (km|miles|kg|pounds|liters?|gallons?|celsius|fahrenheit)|in (km|miles|kg|lb|usd|eur|gbp|inr))\b/i.test(
      text,
    )
  ) {
    return {
      complexity: "simple",
      needsTools: true,
      needsRetrieval: false,
      domain: "general",
    }
  }

  const { model, apiKey } = createRouterModelWithKey()

  try {
    const router = model.withStructuredOutput(RouteSchema)
    const route = await router.invoke([
      new SystemMessage(ROUTER_SYSTEM_PROMPT),
      ...messages.slice(-ROUTER_HISTORY_LIMIT),
    ], buildLangSmithConfig({ ...traceContext, selectedTier: "router" }, "router-route") as any)
    return route
  } catch (error) {
    if (isRetryableModelError(error)) {
      groqApiKeyManager.markKeyCooldown(apiKey)
    }

    return {
      complexity: "medium",
      needsTools: true,
      needsRetrieval: false,
      domain: "general",
    }
  }
}

export async function selectRoutedModel(
  request: RoutedModelRequest,
  traceContext?: RoutedModelTraceContext,
): Promise<RoutedModelResult> {
  const route = await classifyRoute(request.messages, traceContext)
  const tier = getTierForRoute(route)
  const selected = createModelForTier(tier)
  const tools = request.tools as Array<{ name: string } & Record<string, unknown>>
  const traceConfig = buildLangSmithConfig(
    {
      ...traceContext,
      routeDomain: route.domain,
      routeComplexity: route.complexity,
      routeNeedsTools: route.needsTools,
      routeNeedsRetrieval: route.needsRetrieval,
      selectedTier: tier,
      toolNames: tools.map((tool) => tool.name),
    },
    "agent-turn",
  )

  return {
    route,
    tier,
    model: selected.model,
    apiKey: selected.apiKey,
    tools,
    traceConfig,
  }
}

export { classifyRoute }
