import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { streamAgent } from "@/lib/agent/graph"
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages"
import { summarizeMessages } from "@/lib/agent/summarize"
import { AGENT_SYSTEM_PROMPT } from "@/lib/prompts"

export const maxDuration = 60

// Summarize when unsummarized messages exceed this count
const SUMMARIZE_THRESHOLD = 10

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { chatId, message } = await req.json()

  let currentChatId = chatId

  // Create chat if this is a new conversation
  if (!currentChatId) {
    const chat = await prisma.chat.create({
      data: {
        title: message.substring(0, 80),
        userId,
      },
    })
    currentChatId = chat.id
  }

  // Store user message
  await prisma.message.create({
    data: {
      chatId: currentChatId,
      content: message,
      role: "user",
    },
  })

  // Load chat with summary + full history
  const chat = await prisma.chat.findUnique({
    where: { id: currentChatId },
    select: { summary: true, summarizedUpToIndex: true },
  })

  const history = await prisma.message.findMany({
    where: { chatId: currentChatId },
    orderBy: { createdAt: "asc" },
  })

  // Convert to LangChain messages
  const langchainMessages = [
    new SystemMessage(AGENT_SYSTEM_PROMPT),
    ...history.map((msg) => {
      if (msg.role === "user") return new HumanMessage(msg.content)
      // Strip stored tool call markers for context
      const cleanContent = msg.content.replace(
        /<<<TOOL_CALL:[\s\S]*?<<<END_TOOL_CALL>>>\n?/g,
        ""
      )
      return new AIMessage(cleanContent)
    }),
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      const safeClose = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // Ignore double-close / already-closed errors.
        }
      }

      const send = (data: Record<string, unknown>) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      req.signal.addEventListener("abort", safeClose, { once: true })

      try {
        if (!chatId) {
          send({ type: "chat_created", chatId: currentChatId })
        }

        let fullResponse = ""
        const storedParts: string[] = []
        let currentText = ""
        let pendingStreamText = ""

        const flushPendingStreamText = () => {
          const text = pendingStreamText.trimEnd()
          if (text) {
            send({ type: "token", content: text })
          }
          pendingStreamText = ""
        }

        for await (const event of streamAgent(
          langchainMessages,
          chat?.summary || undefined
        )) {
          switch (event.type) {
            case "token":
              fullResponse += event.content
              currentText += event.content
              pendingStreamText += event.content

              const shouldFlush =
                pendingStreamText.length >= 24 ||
                /[\s\n][^\s]*$/.test(pendingStreamText) ||
                /[.!?]\s*$/.test(pendingStreamText)

              if (shouldFlush) {
                flushPendingStreamText()
              }
              break
            case "tool_start":
              flushPendingStreamText()
              if (currentText) {
                storedParts.push(currentText)
                currentText = ""
              }
              storedParts.push(
                `<<<TOOL_CALL:${event.name}>>>\n${JSON.stringify(event.input)}\n`
              )
              send(event)
              break
            case "tool_end":
              flushPendingStreamText()
              storedParts.push(`${event.output}\n<<<END_TOOL_CALL>>>`)
              send(event)
              break
          }
        }

        flushPendingStreamText()

        if (currentText) {
          storedParts.push(currentText)
        }

        const storedContent =
          storedParts.length > 0 ? storedParts.join("\n") : fullResponse

        if (storedContent.trim()) {
          await prisma.message.create({
            data: {
              chatId: currentChatId,
              content: storedContent,
              role: "assistant",
            },
          })
        }

        // Trigger async summarization if needed
        const summarizedUpTo = chat?.summarizedUpToIndex ?? 0
        const unsummarizedCount = history.length + 1 - summarizedUpTo // +1 for the assistant reply we just stored
        if (unsummarizedCount > SUMMARIZE_THRESHOLD) {
          triggerSummarization(
            currentChatId,
            chat?.summary || null,
            history.map((m) => ({ role: m.role, content: m.content })),
            summarizedUpTo
          )
        }

        send({ type: "done" })
      } catch (error) {
        console.error("Stream error:", error)
        if (!closed) {
          send({
            type: "error",
            message:
              error instanceof Error ? error.message : "An error occurred",
          })
        }
      } finally {
        safeClose()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

/**
 * Fire-and-forget summarization.
 * Summarizes messages from summarizedUpTo onward (excluding the most recent ones
 * which will be sent as raw messages next time).
 */
function triggerSummarization(
  chatId: string,
  existingSummary: string | null,
  allMessages: { role: string; content: string }[],
  summarizedUpTo: number
) {
  // Summarize everything except the last few messages (those stay as raw context)
  const keepRaw = 6
  const endIndex = Math.max(summarizedUpTo, allMessages.length - keepRaw)
  const toSummarize = allMessages.slice(summarizedUpTo, endIndex)

  if (toSummarize.length < 4) return // Not enough new messages to bother

  summarizeMessages({ existingSummary, messagePairs: toSummarize })
    .then((summary) =>
      prisma.chat.update({
        where: { id: chatId },
        data: { summary, summarizedUpToIndex: endIndex },
      })
    )
    .catch((err) => console.error("Summarization failed:", err))
}
