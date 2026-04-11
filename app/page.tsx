import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs"
import { Bot, Search, Cloud, Calculator, Globe, Zap } from "lucide-react"
import Link from "next/link"

const tools = [
  { icon: Search, label: "Web Search" },
  { icon: Globe, label: "Wikipedia" },
  { icon: Cloud, label: "Weather" },
  { icon: Calculator, label: "Calculator" },
  { icon: Globe, label: "Web Reader" },
  { icon: Zap, label: "Real-time" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-zinc-950">
      <div className="max-w-2xl text-center space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Bot className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Worker AI
          </h1>
          <p className="text-xl text-zinc-400 mt-3">
            AI assistant with real-time tools
          </p>
        </div>

        {/* Tools grid */}
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          {tools.map((tool, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-zinc-400"
            >
              <tool.icon className="w-3.5 h-3.5 text-cyan-400" />
              {tool.label}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4">
          <SignedIn>
            <Link
              href="/chat"
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-medium text-lg hover:opacity-90 transition-opacity"
            >
              Open Chat
            </Link>
          </SignedIn>

          <SignedOut>
            <SignInButton
              mode="modal"
              fallbackRedirectUrl="/chat"
              forceRedirectUrl="/chat"
            >
              <button className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-medium text-lg hover:opacity-90 transition-opacity cursor-pointer">
                Get Started
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </div>
  )
}
