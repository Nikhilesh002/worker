import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const { userId } = await auth()
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const chats = await prisma.chat.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  })

  return NextResponse.json(chats)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title } = await req.json()

  const chat = await prisma.chat.create({
    data: { title: title || "New Chat", userId },
  })

  return NextResponse.json(chat)
}
