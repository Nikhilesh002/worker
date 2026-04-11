import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { streamAgent } from "@/lib/agent/graph"
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages"
import { SYSTEM_PROMPT } from "@/lib/agent/systemPrompt"

export const maxDuration = 60

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

  // Get chat history for context
  const history = await prisma.message.findMany({
    where: { chatId: currentChatId },
    orderBy: { createdAt: "asc" },
  })

  // Convert to LangChain messages
  const langchainMessages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...history.map((msg) => {
      if (msg.role === "user") return new HumanMessage(msg.content)
      // Strip stored tool call markers for context
      const cleanContent = msg.content.replace(
        /<<<TOOL_CALL:[\s\S]*?<<<END_TOOL_CALL>>>\n?/g,
        "",
      )
      return new AIMessage(cleanContent)
    }),
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        )
      }

      try {
        if (!chatId) {
          send({ type: "chat_created", chatId: currentChatId })
        }

        let fullResponse = ""
        const storedParts: string[] = []
        let currentText = ""

        for await (const event of streamAgent(langchainMessages)) {
          switch (event.type) {
            case "token":
              currentText += event.content
              fullResponse += event.content
              send(event)
              break
            case "tool_start":
              if (currentText) {
                storedParts.push(currentText)
                currentText = ""
              }
              storedParts.push(
                `<<<TOOL_CALL:${event.name}>>>\n${JSON.stringify(event.input)}\n`,
              )
              send(event)
              break
            case "tool_end":
              storedParts.push(`${event.output}\n<<<END_TOOL_CALL>>>`)
              send(event)
              break
          }
        }

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

        send({ type: "done" })
      } catch (error) {
        console.error("Stream error:", error)
        send({
          type: "error",
          message:
            error instanceof Error ? error.message : "An error occurred",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
