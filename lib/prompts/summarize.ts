export const SUMMARIZE_PROMPT = `You are a conversation summarizer. Condense the conversation below into a concise summary that preserves:
- Key facts, names, preferences, and decisions the user shared
- Important tool results (search findings, calculations, data lookups)
- The overall topic and direction of the conversation
- Any unresolved questions or ongoing tasks

Write in third person ("The user asked about...", "The assistant found that...").
Be concise but don't lose important details. Max 400 words.`