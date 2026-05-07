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
  status?: "normal" | "error"
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

    // Optimistic UI
    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, content: userMessage, role: "user" },
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
              window.history.replaceState(
                null,
                "",
                `/chat/${data.chatId}`,
              )
              window.dispatchEvent(new CustomEvent("chat-created"))
              break

            case "token":
              accumulatedContent += data.content
              setStreamedContent(accumulatedContent)
              break

            case "tool_start":
              setToolCalls((prev) => [
                ...prev,
                { name: data.name, input: data.input, status: "running" },
              ])
              break

            case "tool_end":
              setToolCalls((prev) => {
                const idx = prev.findIndex(
                  (tc) =>
                    tc.name === data.name && tc.status === "running",
                )
                if (idx === -1) return prev
                const updated = [...prev]
                updated[idx] = {
                  ...updated[idx],
                  output: data.output,
                  status: "done",
                }
                return updated
              })
              break

            case "done":
              if (accumulatedContent.trim()) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `msg-${Date.now()}`,
                    content: accumulatedContent,
                    role: "assistant",
                  },
                ])
              }
              setStreamedContent("")
              setToolCalls([])
              break

            case "error":
              console.error("Stream error:", data.message)
              setStreamedContent("")
              setToolCalls([])
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
              break
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      setStreamedContent("")
      setToolCalls([])
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
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="text-center max-w-lg">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 flex items-center justify-center mx-auto mb-5">
                <Sparkles className="w-7 h-7 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent mb-2">
                Worker AI
              </h2>
              <p className="text-zinc-500 text-sm mb-8">
                AI assistant with web search, weather, Wikipedia, calculator
                &amp; more
              </p>

              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-4 space-y-4 pb-4">
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
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-white" />
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
                ) : (
                  toolCalls.length === 0 && (
                    <div className="flex gap-3 items-center">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0ms]" />
                        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:border-cyan-500/30 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all">
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
              className="flex-1 bg-transparent resize-none text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none max-h-40"
              rows={1}
              disabled={isStreaming}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 text-center mt-2">
            Powered by Groq + LangGraph &middot; Enter to send, Shift+Enter
            for new line
          </p>
        </div>
      </div>
    </div>
  )
}
