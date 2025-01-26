import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import wxflows from "@wxflows/sdk/langchain";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";

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

const initializeModel = async () => {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.6,
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

const createWorkflow = async () => {
  const llm = await initializeModel();

  const stateGraph = new StateGraph(MessagesAnnotation);
  
};
