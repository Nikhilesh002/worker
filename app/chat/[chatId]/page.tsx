"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ChatInterface } from "@/components/chat/ChatInterface"

export default function ChatPage() {
  const params = useParams()
  const chatId = params.chatId as string
  const [messages, setMessages] = useState<
    Array<{ id: string; content: string; role: "user" | "assistant" }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/chats/${chatId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [chatId])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    )
  }

  return <ChatInterface chatId={chatId} initialMessages={messages} />
}
