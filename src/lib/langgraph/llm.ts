import { SYSTEM_MESSAGE } from "../../../constants/systemMessage";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { MessagesAnnotation } from "@langchain/langgraph";
import { SystemMessage, trimMessages } from "@langchain/core/messages";
import { tools } from "../tools/toolNode";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";

export const initializeModel = async () => {
  if (process.env.ENV === "dev") {
    return new ChatOllama({
      model: "llama3.2:3b",
      temperature: 0.1,
      maxRetries: 2,
      streaming: true, // so it return AIMessageChunk instead of AIMesssage
      cache: true,
      // verbose: true,
    }).bindTools(tools);
  } else {
    return new ChatGroq({
      model: "gemma2-9b-it",
      apiKey: process.env.AI_API_KEY,
      temperature: 0.1,
      maxRetries: 2,
      maxTokens: 2048,
      streaming: true,
      cache: true,
    }).bindTools(tools);
  }
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
  const resp = await llm.invoke(prompt, { recursionLimit: 20 });

  // return response
  return { messages: [resp] };
};
