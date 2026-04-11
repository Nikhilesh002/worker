import { ChatGroq } from "@langchain/groq"

const apiKeys = process.env.GROQ_API_KEYS?.split("|") || []

export function getModel() {
  if (apiKeys.length === 0) {
    throw new Error("No GROQ API keys provided in GROQ_API_KEYS env variable")
  }
  const randomIndex = Math.floor(Math.random() * apiKeys.length)
  return new ChatGroq({
    apiKey: apiKeys[randomIndex],
    model: "llama-3.3-70b-versatile", // Supports tool calling
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  })
}
