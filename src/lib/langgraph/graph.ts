import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { optimiseMessages } from "./optimiseMessages";
import { call_llm } from "./llm";
import { toolNode } from "../tools/toolNode";
import { logger } from "../../../logger";

const what_next = (state: typeof MessagesAnnotation.State): string => {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // if last msg has a tool call (only LLM can do tool calls)
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "call_tool";
  }

  if (lastMessage.content && lastMessage.getType() === "tool") {
    return "call_llm";
  }

  return END;
};

const createWorkflow = async () => {
  const graph = new StateGraph(MessagesAnnotation);

  // add node named 'agent'
  graph
    .addNode("call_llm", call_llm)
    .addNode("call_tool", toolNode) // connect with edges
    .addEdge(START, "call_llm")
    .addConditionalEdges("call_llm", what_next)
    .addEdge("call_tool", "call_llm");
  // .addEdge("call_llm", END)

  return graph;
};

export const submitQuestion = async (
  messages: BaseMessage[],
  chatId: string
) => {
  const workflow = await createWorkflow();

  // create memory saver
  const memory = new MemorySaver();

  const agent = workflow.compile({ checkpointer: memory });

  const stream = await agent.streamEvents(
    { messages: optimiseMessages(messages) }, // state
    {
      // config
      version: "v2",
      configurable: {
        thread_id: chatId,
      },
      streamMode: "messages",
      runId: chatId,
    }
  );
  logger.info({stream})
  return stream;
};
