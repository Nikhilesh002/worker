"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Check } from "lucide-react"

interface ToolCallProps {
  toolCall: {
    name: string
    input: unknown
    output?: string
    status: "running" | "done"
  }
}

const toolMeta: Record<string, { icon: string; label: string }> = {
  web_search: { icon: "\uD83D\uDD0D", label: "Web Search" },
  wikipedia: { icon: "\uD83D\uDCDA", label: "Wikipedia" },
  get_weather: { icon: "\u26C5", label: "Weather" },
  calculator: { icon: "\uD83E\uDDEE", label: "Calculator" },
  read_webpage: { icon: "\uD83C\uDF10", label: "Read Webpage" },
  get_datetime: { icon: "\uD83D\uDD50", label: "Date & Time" },
}

export function ToolCallDisplay({ toolCall }: ToolCallProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isRunning = toolCall.status === "running"
  const meta = toolMeta[toolCall.name] || {
    icon: "\uD83D\uDD27",
    label: toolCall.name,
  }

  return (
    <div className="my-2 rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden max-w-full min-w-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/[0.04] transition-colors cursor-pointer min-w-0"
      >
        {isRunning ? (
          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        )}

        <span>{meta.icon}</span>
        <span className="font-medium text-zinc-200 truncate max-w-[12rem] flex-1 min-w-0">
          {meta.label}
        </span>

        {isRunning && (
          <span className="text-amber-400/70 text-[11px] ml-1">
            running...
          </span>
        )}

        <span className="ml-auto">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/[0.04]">
          <div className="mt-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
              Input
            </div>
            <pre className="text-xs bg-black/40 rounded-md p-2 overflow-x-auto max-w-full text-cyan-300/90 font-mono whitespace-pre-wrap break-words">
              {typeof toolCall.input === "string"
                ? toolCall.input
                : JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {toolCall.output && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                Output
              </div>
              <pre className="text-xs bg-black/40 rounded-md p-2 overflow-x-auto max-w-full text-emerald-300/90 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                {toolCall.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
