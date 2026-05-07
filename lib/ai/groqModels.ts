import { ChatGroq } from "@langchain/groq"
import { groqApiKeyManager } from "./groqApiKeyManager"

export function createQwenModel() {
  return new ChatGroq({
    apiKey: groqApiKeyManager.getNextApiKey(),
    model: "qwen/qwen3-32b",
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  })
}

export function createExpertModel() {
  return new ChatGroq({
    apiKey: groqApiKeyManager.getNextApiKey(),
    model: "openai/gpt-oss-120b",
    temperature: 0.3,
    maxTokens: 4096,
    streaming: true,
  })
}

export function getModel() {
  return createQwenModel()
}
