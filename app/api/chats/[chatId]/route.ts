import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const { userId } = await auth()
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { chatId } = await params

  const chat = await prisma.chat.findUnique({ where: { id: chatId } })
  if (!chat || chat.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.chat.delete({ where: { id: chatId } })

  return NextResponse.json({ success: true })
}
