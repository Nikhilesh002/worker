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
import { type LangSmithTraceContext } from "@/lib/observability/langsmith"

export const maxDuration = 60

// Summarize when unsummarized messages exceed this count
const SUMMARIZE_THRESHOLD = 10

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { chatId, message } = await req.json()
  const traceContext: LangSmithTraceContext = {
    chatId,
    userId,
    messagePreview: message,
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      let aborted = false
      let assistantStored = false
      let currentChatId = chatId
      let storedParts: string[] = []
      let fullResponse = ""
      let currentText = ""
      let pendingStreamText = ""
      let chat: {
        summary: string | null
        summarizedUpToIndex: number
      } | null = null
      let history: { role: string; content: string }[] = []

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
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          closed = true
        }
      }

      const handleAbort = () => {
        aborted = true
        safeClose()
      }
      req.signal.addEventListener("abort", handleAbort, { once: true })

      const pingInterval = setInterval(() => {
        send({ type: "ping" })
      }, 15000)

      const buildStoredContent = () => {
        const parts: string[] = []
        if (storedParts.length) parts.push(...storedParts)
        if (currentText) parts.push(currentText)
        const candidate = parts.length > 0 ? parts.join("\n") : fullResponse
        return candidate || ""
      }

      const persistAssistantMessage = async () => {
        if (assistantStored) return
        if (!currentChatId) return
        const content = buildStoredContent()
        if (!content.trim()) return
        try {
          await prisma.message.create({
            data: {
              chatId: currentChatId,
              content,
              role: "assistant",
            },
          })
          assistantStored = true
        } catch (error) {
          console.error("Failed to store assistant message:", error)
        }
      }

      try {
        if (!currentChatId) {
          try {
            const createdChat = await prisma.chat.create({
              data: {
                title: message.substring(0, 80),
                userId,
              },
            })
            currentChatId = createdChat.id
            traceContext.chatId = currentChatId
            send({ type: "chat_created", chatId: currentChatId })
          } catch (error) {
            console.error("Failed to create chat:", error)
            send({
              type: "error",
              message:
                "Could not start a chat because the database is unavailable.",
            })
            return
          }
        } else {
          traceContext.chatId = currentChatId
        }

        try {
          await prisma.message.create({
            data: {
              chatId: currentChatId,
              content: message,
              role: "user",
            },
          })

          chat = await prisma.chat.findUnique({
            where: { id: currentChatId },
            select: { summary: true, summarizedUpToIndex: true },
          })

          history = await prisma.message.findMany({
            where: { chatId: currentChatId },
            orderBy: { createdAt: "asc" },
            select: { role: true, content: true },
          })
        } catch (error) {
          console.error("Failed to load chat history:", error)
          history = [{ role: "user", content: message }]
        }

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

        const flushPendingStreamText = () => {
          const text = pendingStreamText.trimEnd()
          if (text) {
            send({ type: "token", content: text })
          }
          pendingStreamText = ""
        }

        for await (const event of streamAgent(
          langchainMessages,
          chat?.summary || undefined,
          traceContext
        )) {
          if (aborted) {
            break
          }
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

        await persistAssistantMessage()

        // Trigger async summarization if needed
        const summarizedUpTo = chat?.summarizedUpToIndex ?? 0
        const unsummarizedCount = history.length + 1 - summarizedUpTo // +1 for the assistant reply we just stored
        if (unsummarizedCount > SUMMARIZE_THRESHOLD) {
          triggerSummarization(
            currentChatId,
            chat?.summary || null,
            history.map((m) => ({ role: m.role, content: m.content })),
            summarizedUpTo,
            traceContext
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
        clearInterval(pingInterval)
        await persistAssistantMessage()
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
  summarizedUpTo: number,
  traceContext?: LangSmithTraceContext
) {
  // Summarize everything except the last few messages (those stay as raw context)
  const keepRaw = 6
  const endIndex = Math.max(summarizedUpTo, allMessages.length - keepRaw)
  const toSummarize = allMessages.slice(summarizedUpTo, endIndex)

  if (toSummarize.length < 4) return // Not enough new messages to bother

  summarizeMessages({
    existingSummary,
    messagePairs: toSummarize,
    traceContext,
  })
    .then((summary) =>
      prisma.chat.update({
        where: { id: chatId },
        data: { summary, summarizedUpToIndex: endIndex },
      })
    )
    .catch((err) => console.error("Summarization failed:", err))
}
