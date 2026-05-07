import { ChatGroq } from "@langchain/groq"
import { groqApiKeyManager } from "./ai/groqApiKeyManager"

export function getModel() {
  return new ChatGroq({
    apiKey: groqApiKeyManager.getNextApiKey(),
    model: "qwen/qwen3-32b", // must support tool calling
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  })
}
