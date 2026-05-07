import {
  Annotation,
  StateGraph,
  MessagesAnnotation,
  END,
  START,
} from "@langchain/langgraph"
import { AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages"
import { ToolNode } from "@langchain/langgraph/prebuilt"
import { runDynamicModelCall } from "@/lib/ai/dynamicModelMiddleware"
import { retry } from "@/lib/utils"
import { allTools } from "./tools"
import { SYSTEM_PROMPT } from "./systemPrompt"

const toolNode = new ToolNode(allTools)
const toolNames: string[] = allTools.map((t) => t.name)

// Extend state to carry conversation summary
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  summary: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
})

const RECENT_MESSAGES_COUNT = 10

async function callAgent(state: typeof AgentState.State) {
  const { messages, summary } = state

  // Build system prompt with summary context
  let systemContent = SYSTEM_PROMPT
  if (summary) {
    systemContent += `\n\n## Conversation Summary (older context)\n${summary}`
  }

  const hasSystemMessage =
    messages.length > 0 && messages[0] instanceof SystemMessage

  // Strip any existing system message — we build our own with summary
  const userMessages = hasSystemMessage ? messages.slice(1) : messages

  // Keep only recent messages — older context lives in the summary
  const recentMessages =
    userMessages.length > RECENT_MESSAGES_COUNT
      ? userMessages.slice(-RECENT_MESSAGES_COUNT)
      : userMessages

  const trimmedMessages = [new SystemMessage(systemContent), ...recentMessages]

  const response = await retry(
    () =>
      runDynamicModelCall(
        { messages: trimmedMessages, tools: allTools as any },
        async (routedRequest) => {
          const model = routedRequest.model as {
            bindTools: (tools: typeof allTools) => {
              invoke: (messages: BaseMessage[]) => Promise<AIMessage>
            }
          }

          return model.bindTools(routedRequest.tools as any).invoke(routedRequest.messages)
        },
      ),
    2,
    400 + Math.random() * 600,
  )
  return { messages: [response] }
}

function shouldContinue(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1]
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
    return "tools"
  }
  return END
}

const workflow = new StateGraph(AgentState)
  .addNode("agent", callAgent)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "agent")

export const graph = workflow.compile()

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "tool_start"; name: string; input: unknown }
  | { type: "tool_end"; name: string; output: string }

export async function* streamAgent(
  messages: BaseMessage[],
  summary?: string,
): AsyncGenerator<StreamEvent> {
  const eventStream = graph.streamEvents(
    { messages, summary: summary || "" },
    { version: "v2" },
  )

  for await (const event of eventStream) {
    switch (event.event) {
      case "on_chat_model_stream": {
        const content = event.data?.chunk?.content
        if (typeof content === "string" && content) {
          yield { type: "token", content }
        }
        break
      }
      case "on_tool_start": {
        if (toolNames.includes(event.name)) {
          yield {
            type: "tool_start",
            name: event.name,
            input: event.data?.input,
          }
        }
        break
      }
      case "on_tool_end": {
        if (toolNames.includes(event.name)) {
          const output = event.data?.output
          let outputStr: string
          if (typeof output === "string") {
            outputStr = output
          } else if (output?.content) {
            outputStr =
              typeof output.content === "string"
                ? output.content
                : JSON.stringify(output.content)
          } else {
            outputStr = JSON.stringify(output)
          }
          yield { type: "tool_end", name: event.name, output: outputStr }
        }
        break
      }
    }
  }
}
