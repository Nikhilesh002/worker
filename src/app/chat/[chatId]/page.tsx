import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "../../../../convex/convex";
import { api } from "../../../../convex/_generated/api";
import { redirect } from "next/navigation";
import ChatInterface from "../_components/ChatInterface";

async function page({ params }: any) {
  const { chatId } = await params;

  // user auth
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  console.log(userId);

  try {
    const convex = await getConvexClient();

    // get initial chat data
    const initialMessages = await convex.query(api.messages.listMessages, { chatId });

    return <div className="text-white pt-16">
      <ChatInterface chatId={chatId} initialMessages={initialMessages} />
    </div>;
  } catch (error) {
    console.error(error);
    redirect("/chat");
  }
}

export default page;
