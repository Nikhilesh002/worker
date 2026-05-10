import { ChatGroq } from "@langchain/groq"
import { groqApiKeyManager } from "./groqApiKeyManager"

function createGroqModel(options: {
  model: string
  temperature: number
  maxTokens: number
  streaming: boolean
}) {
  const apiKey = groqApiKeyManager.getNextApiKey()
  return {
    apiKey,
    model: new ChatGroq({ apiKey, ...options }),
  }
}

export function createQwenModelWithKey() {
  return createGroqModel({
    model: "openai/gpt-oss-20b",
    // model: "qwen/qwen3-32b",
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  })
}

export function createQwenModel() {
  return createQwenModelWithKey().model
}

export function createMediumModelWithKey() {
  return createGroqModel({
    model: "openai/gpt-oss-20b",
    temperature: 0.3,
    maxTokens: 4096,
    streaming: true,
  })
}

export function createMediumModel() {
  return createMediumModelWithKey().model
}

export function createRouterModelWithKey() {
  return createGroqModel({
    model: "openai/gpt-oss-20b",
    temperature: 0,
    maxTokens: 256,
    streaming: false,
  })
}

export function createExpertModel() {
  return createExpertModelWithKey().model
}

export function createExpertModelWithKey() {
  return createGroqModel({
    model: "openai/gpt-oss-120b",
    temperature: 0.2,
    maxTokens: 4096,
    streaming: true,
  })
}

export function createRouterModel() {
  return createRouterModelWithKey().model
}

export function getModel() {
  return createQwenModel()
}
