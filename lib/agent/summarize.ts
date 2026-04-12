import { getModel } from "../groq"
import { retry } from "@/lib/utils"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"

const SUMMARIZE_PROMPT = `You are a conversation summarizer. Condense the conversation below into a concise summary that preserves:
- Key facts, names, preferences, and decisions the user shared
- Important tool results (search findings, calculations, data lookups)
- The overall topic and direction of the conversation
- Any unresolved questions or ongoing tasks

Write in third person ("The user asked about...", "The assistant found that...").
Be concise but don't lose important details. Max 400 words.`

export async function summarizeMessages(
  existingSummary: string | null,
  messagePairs: { role: string; content: string }[],
): Promise<string> {
  let input = ""

  if (existingSummary) {
    input += `Previous conversation summary:\n${existingSummary}\n\n---\n\nNew messages to incorporate:\n`
  }

  for (const msg of messagePairs) {
    const label = msg.role === "user" ? "User" : "Assistant"
    // Strip tool call markers for cleaner summarization
    const clean = msg.content.replace(
      /<<<TOOL_CALL:[\s\S]*?<<<END_TOOL_CALL>>>\n?/g,
      "",
    )
    if (clean.trim()) {
      input += `${label}: ${clean.trim()}\n\n`
    }
  }

  const response = await retry(
    () =>
      getModel().invoke([
        new SystemMessage(SUMMARIZE_PROMPT),
        new HumanMessage(input),
      ]),
    2,
    400 + Math.random() * 600,
  )

  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content)
}
