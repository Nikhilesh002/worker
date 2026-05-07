import { AIMessage, BaseMessage, SystemMessage, ToolMessage } from "@langchain/core/messages"
import { retry } from "@/lib/utils"
import { selectRoutedModel } from "@/lib/ai/dynamicModelMiddleware"
import { allTools } from "./tools"
import { SYSTEM_PROMPT } from "./systemPrompt"

const RECENT_MESSAGES_COUNT = 10

const toolNames = allTools.map((tool) => tool.name)
const toolMap = new Map(allTools.map((tool) => [tool.name, tool]))

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "tool_start"; name: string; input: unknown }
  | { type: "tool_end"; name: string; output: string }

export async function* streamAgent(
  messages: BaseMessage[],
  summary?: string,
): AsyncGenerator<StreamEvent> {
  const { model, tools, route } = await selectRoutedModel({
    messages,
    tools: allTools as any,
  })

  const boundModel = model.bindTools(tools as any)

  const systemContent = summary
    ? `${SYSTEM_PROMPT}\n\n## Conversation Summary (older context)\n${summary}`
    : SYSTEM_PROMPT

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

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let fullMessage: AIMessage | null = null

    const stream = await retry(
      () => boundModel.stream(workingMessages),
      2,
      400 + Math.random() * 600,
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

    for (const toolCall of toolCalls) {
      if (!toolNames.includes(toolCall.name as never)) {
        continue
      }

      const tool = toolMap.get(toolCall.name as never)
      if (!tool) {
        continue
      }

      yield {
        type: "tool_start",
        name: toolCall.name,
        input: toolCall.args,
      }

      const output = await (tool as any).invoke(toolCall.args)
      const outputStr =
        typeof output === "string" ? output : JSON.stringify(output)

      yield { type: "tool_end", name: toolCall.name, output: outputStr }

      workingMessages.push(
        new ToolMessage({
          content: outputStr,
          tool_call_id: toolCall.id || "tool-call",
        }),
      )
    }
  }
}
