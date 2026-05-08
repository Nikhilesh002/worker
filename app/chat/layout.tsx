"use client"

import { useState } from "react"
import { Sidebar } from "@/components/chat/Sidebar"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="h-screen bg-zinc-950 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <main
        className={`h-full overflow-hidden transition-all duration-200 ${sidebarOpen ? "ml-72" : "ml-0"}`}
      >
        {children}
      </main>
    </div>
  )
}
