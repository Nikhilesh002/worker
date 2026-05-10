"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageBubble } from "./MessageBubble"
import { ToolCallDisplay } from "./ToolCallDisplay"
import { Send, Sparkles } from "lucide-react"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  createdAt?: string
  status?: "normal" | "error" | "loading"
  retryPrompt?: string
}

interface ToolCall {
  name: string
  input: unknown
  output?: string
  status: "running" | "done"
}

interface ChatInterfaceProps {
  chatId?: string
  initialMessages?: Message[]
}

const SUGGESTIONS = [
  "What's the weather in Tokyo?",
  "Search the web for latest AI news",
  "Calculate sqrt(144) + 2^10",
  "Tell me about quantum computing",
  "What time is it in New York?",
  "Read https://example.com",
]

export function ChatInterface({
  chatId,
  initialMessages = [],
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamedContent, setStreamedContent] = useState("")
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const currentChatId = useRef(chatId)
  const pendingAssistantId = useRef<string | null>(null)
  const toolCallsRef = useRef<ToolCall[]>([])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(scrollToBottom, [messages, streamedContent, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px"
    }
  }, [input])

  const handleSend = async (overrideMessage?: string) => {
    const userMessage = (overrideMessage || input).trim()
    if (!userMessage || isStreaming) return

    setInput("")
    setIsStreaming(true)
    setStreamedContent("")
    setToolCalls([])
    toolCallsRef.current = []

    const assistantLoadingId = `loading-${Date.now()}`
    pendingAssistantId.current = assistantLoadingId

    // Optimistic UI
    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, content: userMessage, role: "user" },
      {
        id: assistantLoadingId,
        content: "Thinking...",
        role: "assistant",
        status: "loading",
      },
    ])

    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: currentChatId.current,
          message: userMessage,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let accumulatedContent = ""
      let didFinalize = false

      const serializeToolCalls = (items: ToolCall[]) => {
        const doneItems = items.filter((item) => item.status === "done")
        if (!doneItems.length) return ""
        return doneItems
          .map((item) => {
            const input =
              typeof item.input === "string"
                ? item.input
                : JSON.stringify(item.input)
            const output = item.output ?? ""
            return `<<<TOOL_CALL:${item.name}>>>\n${input}\n${output}\n<<<END_TOOL_CALL>>>`
          })
          .join("\n")
      }

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue

          let data
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          switch (data.type) {
            case "chat_created":
              currentChatId.current = data.chatId
              window.history.replaceState(null, "", `/chat/${data.chatId}`)
              window.dispatchEvent(new CustomEvent("chat-created"))
              break

            case "ping":
              break

            case "token":
              if (pendingAssistantId.current) {
                setMessages((prev) =>
                  prev.filter((msg) => msg.id !== pendingAssistantId.current)
                )
                pendingAssistantId.current = null
              }
              accumulatedContent += data.content
              setStreamedContent(accumulatedContent)
              break

            case "tool_start":
              setToolCalls((prev) => {
                const next = [
                  ...prev,
                  { name: data.name, input: data.input, status: "running" },
                ]
                toolCallsRef.current = next
                return next
              })
              break

            case "tool_end":
              setToolCalls((prev) => {
                const idx = prev.findIndex(
                  (tc) => tc.name === data.name && tc.status === "running"
                )
                if (idx === -1) return prev
                const updated = [...prev]
                updated[idx] = {
                  ...updated[idx],
                  output: data.output,
                  status: "done",
                }
                toolCallsRef.current = updated
                return updated
              })
              break

            case "done":
              if (pendingAssistantId.current) {
                setMessages((prev) =>
                  prev.filter((msg) => msg.id !== pendingAssistantId.current)
                )
                pendingAssistantId.current = null
              }
              if (accumulatedContent.trim()) {
                const toolMarkers = serializeToolCalls(toolCallsRef.current)
                const finalContent = toolMarkers
                  ? `${accumulatedContent}\n${toolMarkers}`
                  : accumulatedContent
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `msg-${Date.now()}`,
                    content: finalContent,
                    role: "assistant",
                  },
                ])
              }
              setStreamedContent("")
              setToolCalls([])
              didFinalize = true
              break

            case "error":
              console.error("Stream error:", data.message)
              setStreamedContent("")
              setToolCalls([])
              if (pendingAssistantId.current) {
                setMessages((prev) =>
                  prev.filter((msg) => msg.id !== pendingAssistantId.current)
                )
                pendingAssistantId.current = null
              }
              setMessages((prev) => [
                ...prev,
                {
                  id: `err-${Date.now()}`,
                  content: `Error: ${data.message}`,
                  role: "assistant",
                  status: "error",
                  retryPrompt: userMessage,
                },
              ])
              didFinalize = true
              break
          }
        }
      }

      if (!didFinalize) {
        if (pendingAssistantId.current) {
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== pendingAssistantId.current)
          )
          pendingAssistantId.current = null
        }
        setToolCalls([])
        setStreamedContent("")

        if (accumulatedContent.trim()) {
          const toolMarkers = serializeToolCalls(toolCallsRef.current)
          const finalContent = toolMarkers
            ? `${accumulatedContent}\n${toolMarkers}`
            : accumulatedContent
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              content: finalContent,
              role: "assistant",
            },
          ])
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              content: "Stream ended unexpectedly. Please try again.",
              role: "assistant",
              status: "error",
              retryPrompt: userMessage,
            },
          ])
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      setStreamedContent("")
      setToolCalls([])
      if (pendingAssistantId.current) {
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== pendingAssistantId.current)
        )
        pendingAssistantId.current = null
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          content: "Failed to get a response. Please try again.",
          role: "assistant",
          status: "error",
          retryPrompt: userMessage,
        },
      ])
    } finally {
      setIsStreaming(false)
    }
  }

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="w-full max-w-2xl text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
                <Sparkles className="h-7 w-7 text-cyan-400" />
              </div>
              <h2 className="mb-2 bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-2xl font-bold text-transparent">
                Worker AI
              </h2>
              <p className="mb-8 text-sm text-zinc-500">
                AI assistant with web search, weather, Wikipedia, calculator
                &amp; more
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 text-xs text-zinc-400 transition-all hover:border-cyan-500/20 hover:bg-white/[0.06] hover:text-zinc-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-4 p-4 pb-4 xl:max-w-3xl">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRetry={
                  msg.status === "error" && msg.retryPrompt
                    ? () => handleSend(msg.retryPrompt)
                    : undefined
                }
              />
            ))}

            {isStreaming && (
              <div className="space-y-3">
                {toolCalls.length > 0 && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 space-y-2">
                      {toolCalls.map((tc, i) => (
                        <ToolCallDisplay key={i} toolCall={tc} />
                      ))}
                    </div>
                  </div>
                )}

                {streamedContent ? (
                  <MessageBubble
                    message={{
                      id: "streaming",
                      content: streamedContent,
                      role: "assistant",
                    }}
                    isStreaming
                  />
                ) : null}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.04] bg-zinc-950/80 p-4 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-2xl xl:max-w-3xl">
          <div className="relative flex items-end gap-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition-all focus-within:border-cyan-500/30 focus-within:ring-1 focus-within:ring-cyan-500/20">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Type a message..."
              className="max-h-40 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              rows={1}
              disabled={isStreaming}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <Send className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-600">
            Powered by Groq + LangGraph &middot; Enter to send, Shift+Enter for
            new line
          </p>
        </div>
      </div>
    </div>
  )
}
