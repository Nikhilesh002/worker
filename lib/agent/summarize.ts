import { createQwenModel } from "../groq"
import { retry } from "@/lib/utils"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { SUMMARIZE_PROMPT } from "@/lib/prompts"

export async function summarizeMessages({
  existingSummary,
  messagePairs,
}: {
  existingSummary: string | null
  messagePairs: { role: string; content: string }[]
}): Promise<string> {
  let input = ""

  if (existingSummary) {
    input += `Previous conversation summary:\n${existingSummary}\n\n---\n\nNew messages to incorporate:\n`
  }

  for (const msg of messagePairs) {
    const label = msg.role === "user" ? "User" : "Assistant"
    // Strip tool call markers for cleaner summarization
    const clean = msg.content.replace(
      /<<<TOOL_CALL:[\s\S]*?<<<END_TOOL_CALL>>>\n?/g,
      ""
    )
    if (clean.trim()) {
      input += `${label}: ${clean.trim()}\n\n`
    }
  }

  const response = await retry(
    () =>
      createQwenModel().invoke([
        new SystemMessage(SUMMARIZE_PROMPT),
        new HumanMessage(input),
      ]),
    2,
    400 + Math.random() * 600
  )

  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content)
}
