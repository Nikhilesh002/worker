import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import wxflows from "@wxflows/sdk/langchain";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { SYSTEM_MESSAGE } from "../../constants/systemMessage";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  AIMessage,
  BaseMessage,
  SystemMessage,
  trimMessages,
} from "@langchain/core/messages";

// customers at: https://introspection.apis.stepzen.com/customers

// coments at: https://dummyjson.com/comments

// connect to wxflows
const toolClient = new wxflows({
  endpoint: process.env.WXFLOWS_ENDPOINT ?? "",
  apikey: process.env.WXFLOWS_API_KEY ?? "",
  flowName: "workerAI",
});

// retrieve tools
const tools = await toolClient.lcTools;
const toolNode = new ToolNode(tools);

// trim messages
const trimmer = trimMessages({
  maxTokens: 10,
  tokenCounter: (msgs) => msgs.length,
  strategy: "last",
  allowPartial: true,
  startOn: "human",
  includeSystem: true,
});

const initializeModel = async () => {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.1,
    maxRetries: 2,
    maxOutputTokens: 4096,
    streaming: true,
    cache: true,
    callbacks: [
      {
        handleLLMStart: async () => {
          console.log("Starting LLM...");
        },
        handleLLMEnd(output, runId, parentRunId, tags, extraParams) {
          const usage = output.llmOutput?.usage;
          if (usage) {
            console.log("Token Usage:", {
              input_tokens: usage.input_tokens,
              output_tokens: usage.output_tokens,
              total_tokens: usage.input_tokens + usage.output_tokens,
              cache_creation_input_tokens:
                usage.cache_creation_input_tokens || 0,
              cache_read_input_tokens: usage.cache_read_input_tokens || 0,
            });
          }
        },
        handleLLMNewToken: async (token) => {
          console.log("New token:", token);
        },
      },
    ],
  }).bindTools(tools);

  return llm;
};

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
  const llm = await initializeModel();

  const graph = new StateGraph(MessagesAnnotation);

  // add node named 'agent'
  graph
    .addNode("call_llm", async (state) => {
      const systemContent = SYSTEM_MESSAGE;

      // create prompt template
      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(systemContent),
        new MessagesPlaceholder("messages"),
      ]);

      // take only last messages
      const trimmedMessages = await trimmer.invoke(state.messages);

      // create prompt with PromptTemplate
      const prompt = await promptTemplate.invoke({ messages: trimmedMessages });

      // call LLM
      const resp = await llm.invoke(prompt);

      // return response
      return { messages: [resp] };
    })
    .addNode("call_tool", toolNode) // connect with edges
    .addEdge(START, "call_llm")
    .addConditionalEdges("call_llm", what_next)
    .addEdge("call_tool", "call_llm");

  return graph;
};

export const submitQuestion = async (
  messages: BaseMessage[],
  chatId: string
) => {
  const workflow = await createWorkflow();

  // create memory saver
  const agentCheckPointer = new MemorySaver();

  const agent = workflow.compile({ checkpointer: agentCheckPointer });

  const stream = await agent.streamEvents(
    { messages },
    {
      version: "v2",
      configurable: {
        thread_id: chatId,
      },
      streamMode: "messages",
      runId: chatId,
    }
  );

  return stream;
};
