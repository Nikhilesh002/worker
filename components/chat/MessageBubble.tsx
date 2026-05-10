"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
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

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => (
          <p className="mb-2 leading-relaxed break-words last:mb-0">
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
              className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-cyan-300"
              {...props}
            >
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="my-2 max-w-full overflow-x-auto rounded-lg border border-white/[0.06] bg-black/40 p-3 text-sm">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-1 pl-4">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-1 pl-4">{children}</ol>
        ),
        h1: ({ children }) => (
          <h1 className="mt-3 mb-2 text-xl font-bold">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-3 mb-2 text-lg font-bold">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-2 mb-1 text-base font-semibold">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-cyan-500/40 pl-3 break-words text-zinc-400 italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-2 max-w-full overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left font-medium text-zinc-300">
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

export function MessageBubble({
  message,
  isStreaming,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.role === "user"
  const parts = isUser
    ? [{ type: "text" as const, content: message.content }]
    : parseContent(message.content)
  const isError = message.status === "error"
  const isLoading = message.status === "loading"

  return (
    <div
      className={`flex min-w-0 gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}

      <div
        className={`w-fit max-w-[min(100%,42rem)] min-w-0 overflow-hidden rounded-2xl px-4 py-3 ${
          isUser
            ? "border border-cyan-500/20 bg-cyan-500/10 text-zinc-100"
            : isError
              ? "border border-red-500/20 bg-red-500/10 text-zinc-100"
              : isLoading
                ? "border border-white/[0.06] bg-white/[0.03] text-zinc-200"
                : "border border-white/[0.06] bg-white/[0.03] text-zinc-200"
        }`}
      >
        {isLoading ? (
          <div className="flex min-h-8 items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:0ms]" />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-zinc-500">Thinking...</span>
          </div>
        ) : null}

        {isStreaming && !isUser ? (
          <div className="max-w-full min-w-0 overflow-hidden text-sm">
            <MarkdownContent content={message.content} />
          </div>
        ) : (
          parts.map((part, i) =>
            part.type === "text" ? (
              <div
                key={i}
                className="max-w-full min-w-0 overflow-hidden text-sm"
              >
                {isUser ? (
                  <p className="break-words whitespace-pre-wrap">
                    {part.content}
                  </p>
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
            )
          )
        )}

        {isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-cyan-400" />
        )}

        {isError && onRetry && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onRetry}
              className="cursor-pointer rounded-lg border border-red-500/20 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/25"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-zinc-800">
          <User className="h-4 w-4 text-zinc-400" />
        </div>
      )}
    </div>
  )
}
