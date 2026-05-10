"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ToolCallDisplay } from "./ToolCallDisplay"
import { User, Bot } from "lucide-react"

interface MessageBubbleProps {
  message: {
    id: string
    content: string
    role: "user" | "assistant"
    status?: "normal" | "error" | "loading"
  }
  isStreaming?: boolean
  onRetry?: () => void
}

function parseContent(content: string) {
  const parts: Array<
    | { type: "text"; content: string }
    | { type: "tool_call"; name: string; input: string; output: string }
  > = []

  const regex =
    /<<<TOOL_CALL:(.*?)>>>\n([\s\S]*?)\n([\s\S]*?)<<<END_TOOL_CALL>>>/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.substring(lastIndex, match.index).trim()
      if (text) parts.push({ type: "text", content: text })
    }
    parts.push({
      type: "tool_call",
      name: match[1],
      input: match[2],
      output: match[3].trim(),
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    const text = content.substring(lastIndex).trim()
    if (text) parts.push({ type: "text", content: text })
  }

  return parts.length > 0 ? parts : [{ type: "text" as const, content }]
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed break-words">
            {children}
          </p>
        ),
        code: ({ className, children, ...props }) => {
          if (className) {
            return (
              <code className={`${className} text-sm break-words`} {...props}>
                {children}
              </code>
            )
          }
          return (
            <code
              className="px-1.5 py-0.5 rounded bg-white/[0.06] text-cyan-300 text-xs font-mono"
              {...props}
            >
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="bg-black/40 rounded-lg p-3 overflow-x-auto max-w-full border border-white/[0.06] my-2 text-sm">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
        ),
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mb-2 mt-3">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mb-1 mt-2">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-cyan-500/40 pl-3 text-zinc-400 italic my-2 break-words">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 max-w-full">
            <table className="min-w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-white/10 px-3 py-1.5 bg-white/[0.04] text-left font-medium text-zinc-300">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-white/10 px-3 py-1.5 text-zinc-300">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export function MessageBubble({ message, isStreaming, onRetry }: MessageBubbleProps) {
  const isUser = message.role === "user"
  const parts = isUser
    ? [{ type: "text" as const, content: message.content }]
    : parseContent(message.content)
  const isError = message.status === "error"
  const isLoading = message.status === "loading"

  return (
    <div className={`flex gap-3 min-w-0 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div
        className={`w-fit max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 overflow-hidden min-w-0 ${
          isUser
            ? "bg-cyan-500/10 border border-cyan-500/20 text-zinc-100"
            : isError
              ? "bg-red-500/10 border border-red-500/20 text-zinc-100"
              : isLoading
                ? "bg-white/[0.03] border border-white/[0.06] text-zinc-200"
              : "bg-white/[0.03] border border-white/[0.06] text-zinc-200"
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 min-h-8">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-zinc-500">Thinking...</span>
          </div>
        ) : null}

        {isStreaming && !isUser ? (
          <div className="text-sm min-w-0 max-w-full overflow-hidden">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        ) : (
          parts.map((part, i) =>
            part.type === "text" ? (
              <div key={i} className="text-sm min-w-0 max-w-full overflow-hidden">
                {isUser ? (
                  <p className="whitespace-pre-wrap break-words">{part.content}</p>
                ) : (
                  <MarkdownContent content={part.content} />
                )}
              </div>
            ) : (
              <ToolCallDisplay
                key={i}
                toolCall={{
                  name: part.name,
                  input: (() => {
                    try {
                      return JSON.parse(part.input)
                    } catch {
                      return part.input
                    }
                  })(),
                  output: part.output,
                  status: "done",
                }}
              />
            ),
          )
        )}

        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-cyan-400 animate-pulse ml-0.5 rounded-sm" />
        )}

        {isError && onRetry && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onRetry}
              className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/20 text-xs font-medium text-red-200 hover:bg-red-500/25 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-zinc-400" />
        </div>
      )}
    </div>
  )
}
