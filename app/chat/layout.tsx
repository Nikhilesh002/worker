"use client"

import { useState } from "react"
import { Sidebar } from "@/components/chat/Sidebar"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/")
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-zinc-950">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <main
        className={`h-full transition-all duration-200 ${sidebarOpen ? "ml-72" : "ml-0"}`}
      >
        {children}
      </main>
    </div>
  )
}
