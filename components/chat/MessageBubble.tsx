"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import { ToolCallDisplay } from "./ToolCallDisplay"
import { User, Bot, ChevronRight } from "lucide-react"

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

type ContentPart =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | { type: "tool_call"; name: string; input: string; output: string }

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  const regex =
    /<think>([\s\S]*?)<\/think>|<<<TOOL_CALL:(.*?)>>>\n([\s\S]*?)\n([\s\S]*?)<<<END_TOOL_CALL>>>/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.substring(lastIndex, match.index).trim()
      if (text) parts.push({ type: "text", content: text })
    }
    if (match[1] !== undefined) {
      const thinking = match[1].trim()
      if (thinking) parts.push({ type: "thinking", content: thinking })
    } else {
      parts.push({
        type: "tool_call",
        name: match[2],
        input: match[3],
        output: match[4].trim(),
      })
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    const text = content.substring(lastIndex).trim()
    if (text) parts.push({ type: "text", content: text })
  }

  return parts.length > 0 ? parts : [{ type: "text", content }]
}

function stripThinking(content: string): string {
  let result = content.replace(/<think>[\s\S]*?<\/think>/g, "")
  result = result.replace(/<think>[\s\S]*$/, "")
  return result.trim()
}

function isCurrentlyThinking(content: string): boolean {
  return content.includes("<think>") && !content.includes("</think>")
}

function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ChevronRight
          className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
        <span>Thinking</span>
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-white/6 bg-zinc-900/50 px-3 py-2.5 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono">
          {content}
        </div>
      )}
    </div>
  )
}

function preprocessMarkdown(content: string): string {
  // GFM spec: a closing ** preceded by punctuation AND followed by a word character
  // is not a valid right-flanking delimiter, so it won't render as bold.
  // The model often outputs patterns like "**Tokyo (JST)**Monday" — fix by adding a space.
  return content.replace(/([,.!?)\]>}»])\*\*([A-Za-z0-9À-￿])/g, "$1** $2")
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => (
          <p className="mb-3 leading-7 wrap-break-word last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-zinc-100">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-zinc-300">{children}</em>
        ),
        code: ({ className, children, ...props }) => {
          if (className) {
            return (
              <code className={`${className} text-sm break-all`} {...props}>
                {children}
              </code>
            )
          }
          return (
            <code
              className="rounded-md border border-white/6 bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-cyan-300"
              {...props}
            >
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-xl border border-white/8 bg-zinc-900/80 p-4 text-sm leading-relaxed">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 space-y-1.5 pl-5 list-disc marker:text-cyan-500/60">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 space-y-1.5 pl-5 list-decimal marker:text-zinc-500">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed text-zinc-300">{children}</li>
        ),
        h1: ({ children }) => (
          <h1 className="mt-5 mb-3 text-xl font-bold text-zinc-100 border-b border-white/6 pb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-4 mb-2.5 text-lg font-semibold text-zinc-100 border-b border-white/4 pb-1.5">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-3 mb-2 text-base font-semibold text-zinc-200">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-cyan-500/50 pl-4 wrap-break-word text-zinc-400 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-4 border-white/8" />,
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-xl border border-white/8">
            <table className="min-w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-white/4">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-white/4">{children}</tbody>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-white/8">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2.5 text-zinc-300 whitespace-normal">{children}</td>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-white/2 transition-colors">{children}</tr>
        ),
      }}
    >
      {preprocessMarkdown(content)}
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
                ? "border border-white/6 bg-white/3 text-zinc-200"
                : "border border-white/6 bg-white/3 text-zinc-200"
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
            {isCurrentlyThinking(message.content) && (
              <div className="mb-2 flex items-center gap-1.5 text-xs text-zinc-500">
                <div className="h-1 w-1 animate-pulse rounded-full bg-violet-400" />
                <span>Thinking...</span>
              </div>
            )}
            <MarkdownContent content={stripThinking(message.content)} />
          </div>
        ) : (
          parts.map((part, i) =>
            part.type === "thinking" ? (
              <ThinkingBlock key={i} content={part.content} />
            ) : part.type === "text" ? (
              <div
                key={i}
                className="max-w-full min-w-0 overflow-hidden text-sm"
              >
                {isUser ? (
                  <p className="wrap-break-word whitespace-pre-wrap">
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
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/6 bg-zinc-800">
          <User className="h-4 w-4 text-zinc-400" />
        </div>
      )}
    </div>
  )
}
