import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "../../../../convex/convex";
import { api } from "../../../../convex/_generated/api";
import { redirect } from "next/navigation";
import ChatInterface from "../_components/ChatInterface";
import { Id } from "../../../../convex/_generated/dataModel";

async function page({ params }: { params: Promise<{ chatId: string }>}) {

  const { chatId } = await params;

  // user auth
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  try {
    const convex = await getConvexClient();

    // get initial chat data
    const initialMessages = await convex.query(api.messages.listMessages, {
      chatId: chatId as Id<"chats">
    });

    return (
      <div className="text-white ">
        <ChatInterface chatId={chatId as Id<"chats">} initialMessages={initialMessages} />
      </div>
    );
  } catch (error) {
    console.error(error);
    redirect("/chat");
  }
}

export default page;
