import {
  AIMessage,
  BaseMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages"
import { retry } from "@/lib/utils"
import { selectRoutedModel } from "@/lib/ai/dynamicModelMiddleware"
import { createQwenModelWithKey } from "@/lib/ai/groqModels"
import { allTools } from "./tools"
import { AGENT_SYSTEM_PROMPT } from "@/lib/prompts"
import {
  buildLangSmithConfig,
  type LangSmithTraceContext,
} from "@/lib/observability/langsmith"

const RECENT_MESSAGES_COUNT = 10
const MAX_TOOLS_PER_ITERATION = 3

// These tools produce self-contained formatted output — no synthesis LLM call needed.
const SELF_CONTAINED_TOOLS = new Set([
  "get_datetime", "calculator", "random_number", "convert_units",
  "encode_decode", "convert_currency", "ip_lookup", "crypto_price",
])

const toolNames = allTools.map((tool) => tool.name)
const toolMap = new Map(allTools.map((tool) => [tool.name, tool]))

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "tool_start"; name: string; input: unknown }
  | { type: "tool_end"; name: string; output: string }

export async function* streamAgent(
  messages: BaseMessage[],
  summary?: string,
  traceContext?: LangSmithTraceContext
): AsyncGenerator<StreamEvent> {
  const { model, tools, route, tier, traceConfig } = await selectRoutedModel(
    {
      messages,
      tools: allTools as any,
    },
    traceContext
  )

  const boundModel = model.bindTools(tools as any)

  const systemContent = summary
    ? `${AGENT_SYSTEM_PROMPT}\n\n## Conversation Summary (older context)\n${summary}`
    : AGENT_SYSTEM_PROMPT

  const hasSystemMessage = messages[0] instanceof SystemMessage
  const userMessages = hasSystemMessage ? messages.slice(1) : messages
  const recentMessages =
    userMessages.length > RECENT_MESSAGES_COUNT
      ? userMessages.slice(-RECENT_MESSAGES_COUNT)
      : userMessages

  const workingMessages: BaseMessage[] = [
    new SystemMessage(systemContent),
    ...recentMessages,
  ]

  const maxIterations = route.needsTools ? 6 : 2

  const seenToolCalls = new Set<string>()

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let fullMessage: AIMessage | null = null

    const stream = await retry(
      () => boundModel.stream(workingMessages, traceConfig as any),
      2,
      400 + Math.random() * 600
    )

    for await (const chunk of stream) {
      fullMessage = fullMessage
        ? ((fullMessage as any).concat(chunk) as AIMessage)
        : (chunk as AIMessage)

      const content =
        typeof (chunk as any).text === "string" && (chunk as any).text
          ? (chunk as any).text
          : typeof chunk.content === "string"
            ? chunk.content
            : ""
      if (typeof content === "string" && content) {
        yield { type: "token", content }
      }
    }

    if (!fullMessage) {
      break
    }

    workingMessages.push(fullMessage)

    const toolCalls = fullMessage.tool_calls || []
    if (!toolCalls.length) {
      break
    }

    let toolsThisIteration = 0
    let lastToolName: string | null = null
    for (const toolCall of toolCalls) {
      if (!toolNames.includes(toolCall.name as never)) {
        continue
      }

      const tool = toolMap.get(toolCall.name as never)
      if (!tool) {
        continue
      }

      const toolKey = `${toolCall.name}:${JSON.stringify(toolCall.args ?? {})}`
      if (seenToolCalls.has(toolKey)) {
        continue
      }
      seenToolCalls.add(toolKey)

      if (toolsThisIteration >= MAX_TOOLS_PER_ITERATION) {
        workingMessages.push(
          new ToolMessage({
            content: "Tool limit reached. Synthesize from results already gathered.",
            tool_call_id: toolCall.id || "tool-call",
          })
        )
        continue
      }
      toolsThisIteration++

      yield {
        type: "tool_start",
        name: toolCall.name,
        input: toolCall.args,
      }

      const output = await (tool as any).invoke(
        toolCall.args,
        buildLangSmithConfig(
          {
            ...traceContext,
            routeDomain: route.domain,
            routeComplexity: route.complexity,
            routeNeedsTools: route.needsTools,
            routeNeedsRetrieval: route.needsRetrieval,
            toolNames: [toolCall.name],
          },
          `tool:${toolCall.name}`
        ) as any
      )
      const outputStr =
        typeof output === "string" ? output : JSON.stringify(output)

      yield { type: "tool_end", name: toolCall.name, output: outputStr }
      lastToolName = toolCall.name

      workingMessages.push(
        new ToolMessage({
          content: outputStr,
          tool_call_id: toolCall.id || "tool-call",
        })
      )
    }

    // For self-contained tools, synthesize with the small fast model instead of raw output.
    if (
      toolsThisIteration === 1 &&
      lastToolName &&
      SELF_CONTAINED_TOOLS.has(lastToolName)
    ) {
      const { model: synthModel } = createQwenModelWithKey()
      const synthStream = await retry(
        () => synthModel.stream(workingMessages, traceConfig as any),
        2,
        400 + Math.random() * 600
      )
      for await (const chunk of synthStream) {
        const content =
          typeof (chunk as any).text === "string" && (chunk as any).text
            ? (chunk as any).text
            : typeof chunk.content === "string"
              ? chunk.content
              : ""
        if (content) yield { type: "token", content }
      }
      break
    }
  }
}
