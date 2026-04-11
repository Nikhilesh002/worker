import {
  StateGraph,
  MessagesAnnotation,
  END,
  START,
} from "@langchain/langgraph"
import { AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages"
import { ToolNode } from "@langchain/langgraph/prebuilt"
import { getModel } from "../groq"
import { allTools } from "./tools"
import { SYSTEM_PROMPT } from "./systemPrompt"

const toolNode = new ToolNode(allTools)
const toolNames = allTools.map((t) => t.name)

async function callAgent(state: typeof MessagesAnnotation.State) {
  const model = getModel().bindTools(allTools)

  const messages = state.messages
  const hasSystemMessage =
    messages.length > 0 && messages[0] instanceof SystemMessage

  const allMessages = hasSystemMessage
    ? messages
    : [new SystemMessage(SYSTEM_PROMPT), ...messages]

  // Keep system message + last 20 messages to manage context
  const trimmedMessages =
    allMessages.length > 21
      ? [allMessages[0], ...allMessages.slice(-20)]
      : allMessages

  const response = await model.invoke(trimmedMessages)
  return { messages: [response] }
}

function shouldContinue(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1]
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
    return "tools"
  }
  return END
}

const workflow = new StateGraph(MessagesAnnotation)
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
): AsyncGenerator<StreamEvent> {
  const eventStream = graph.streamEvents({ messages }, { version: "v2" })

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
