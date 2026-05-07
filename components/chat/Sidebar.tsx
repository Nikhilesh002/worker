"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
} from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Chat {
  id: string
  title: string
  createdAt: string
}

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const fetchChats = async () => {
    try {
      const res = await fetch("/api/chats")
      if (res.ok) {
        const data = await res.json()
        setChats(data)
      }
    } catch (error) {
      console.error("Failed to fetch chats:", error)
    }
  }

  useEffect(() => {
    fetchChats()
  }, [])

  useEffect(() => {
    const handler = () => fetchChats()
    window.addEventListener("chat-created", handler)
    window.addEventListener("chat-deleted", handler)
    return () => {
      window.removeEventListener("chat-created", handler)
      window.removeEventListener("chat-deleted", handler)
    }
  }, [])

  const handleDelete = async (chatId: string) => {
    try {
      await fetch(`/api/chats/${chatId}`, { method: "DELETE" })
      setChats((prev) => prev.filter((c) => c.id !== chatId))
      if (pathname === `/chat/${chatId}`) {
        router.push("/chat")
      }
      window.dispatchEvent(new Event("chat-deleted"))
    } catch (error) {
      console.error("Failed to delete chat:", error)
    }
    setDeleteChatId(null)
  }

  const activeChatId = pathname.split("/chat/")[1]

  return (
    <>
      {/* Toggle */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-zinc-900/90 border border-white/[0.06] hover:bg-zinc-800 transition-colors backdrop-blur-sm cursor-pointer"
      >
        {isOpen ? (
          <PanelLeftClose className="w-4 h-4 text-zinc-400" />
        ) : (
          <PanelLeft className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-zinc-950/95 backdrop-blur-xl border-r border-white/[0.06] transform transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full pt-16 pb-4">
          {/* Brand */}
          <div className="px-4 mb-2">
            <div className="flex items-center gap-2 px-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                Worker AI
              </span>
            </div>

            <button
              onClick={() => router.push("/chat")}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 text-sm font-medium text-zinc-200 hover:from-cyan-500/20 hover:to-violet-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              New Chat
            </button>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto px-3 mt-2 space-y-0.5 scrollbar-none">
            {chats.length === 0 && (
              <p className="text-xs text-zinc-600 text-center mt-8 px-4">
                No conversations yet. Start a new chat!
              </p>
            )}
            {chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => router.push(`/chat/${chat.id}`)}
                role="button"
                tabIndex={0}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left group transition-all cursor-pointer ${
                  activeChatId === chat.id
                    ? "bg-white/[0.06] text-zinc-100"
                    : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <span className="truncate flex-1">{chat.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteChatId(chat.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all cursor-pointer"
                  aria-label={`Delete ${chat.title}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* User */}
          <div className="px-4 pt-4 border-t border-white/[0.04]">
            <div className="flex items-center gap-3 px-2">
              <UserButton
                appearance={{
                  elements: { avatarBox: "w-7 h-7" },
                }}
              />
              <span className="text-xs text-zinc-500">Account</span>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={deleteChatId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteChatId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the conversation and cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteChatId) {
                  handleDelete(deleteChatId)
                }
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
