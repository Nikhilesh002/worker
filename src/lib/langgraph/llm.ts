import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SYSTEM_MESSAGE } from "../../../constants/systemMessage";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { MessagesAnnotation } from "@langchain/langgraph";
import { SystemMessage, trimMessages } from "@langchain/core/messages";
import { tools } from "./tools";

export const initializeModel = async () => {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.1,
    maxRetries: 2,
    maxOutputTokens: 4096,
    streaming: true, // so it return AIMessageChunk instead of AIMesssage
    cache: true,
    callbacks: [
      {
        // handleLLMStart: async () => {
        //   console.log("Starting LLM...");
        // },
        handleLLMEnd(output) {
          const usage = output.llmOutput?.usage;
          if (usage) {
            // console.log("Token Usage:", {
            //   input_tokens: usage.input_tokens,
            //   output_tokens: usage.output_tokens,
            //   total_tokens: usage.input_tokens + usage.output_tokens,
            //   cache_creation_input_tokens:
            //     usage.cache_creation_input_tokens || 0,
            //   cache_read_input_tokens: usage.cache_read_input_tokens || 0,
            // });
            console.log(
              "Token Usage:",
              usage.input_tokens + usage.output_tokens
            );
          }
        },
        // handleLLMNewToken: async (token) => {
        //   console.log("New token:", token);
        // },
      },
    ],
  }).bindTools(tools);

  // console.log({tools})

  return llm;
};

// trim messages
const trimmer = trimMessages({
  maxTokens: 4,
  tokenCounter: (msgs) => msgs.length,
  strategy: "last",
  allowPartial: true,
  startOn: "human",
  includeSystem: true,
});

export const call_llm = async (state: typeof MessagesAnnotation.State) => {
  const llm = await initializeModel();

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
};
