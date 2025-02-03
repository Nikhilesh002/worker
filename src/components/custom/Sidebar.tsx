import { NavigationContext } from "@/components/NavigationContext/NavigationContextProvider";
import { useRouter } from "next/navigation";
import React, { use } from "react";
import { Button } from "../ui/button";
import { Menu, Plus } from "lucide-react";
import { Separator } from "../ui/separator";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import RecentChats from "@/app/chat/_components/RecentChats";

function Sidebar() {
  const router = useRouter();
  const { isMobileNavOpen, closeMobileNav } = use(NavigationContext);

  const chats = useQuery(api.chats.listChats);
  const createChat = useMutation(api.chats.createChat);
  const deleteChat = useMutation(api.chats.deleteChat);

  const handleNewChatClick = async () => {
    const newChatId = await createChat({ title: "New Chat" });
    router.push(`/chat/${newChatId}`);
    closeMobileNav();
  };

  const handleDeleteChat = async (id: Id<"chats">) => {
    await deleteChat({ id });
  };

  return (
    <>
      {/* bg overlay */}
      {/* {isMobileNavOpen && (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-50 `}
          onClick={closeMobileNav}
        />
      )} */}

      {isMobileNavOpen && (
        <div className="h-full border-r-[3px] border-gray-600 w-64 text-white text-center space-y-6 overflow-auto">
          <div className="space-y-4 mt-4">
            <div className="flex ps-1 ">
              <Button variant={"ghost"} onClick={closeMobileNav}>
                <Menu />
              </Button>
            </div>
            <h1 className="text-rose-400 text-2xl font-bold font-serif">
              Your Chats
            </h1>
            <Button onClick={handleNewChatClick}>
              New Chat <Plus />
            </Button>
          </div>

          <Separator />

          <RecentChats
            chats={chats ?? []}
            handleDeleteChat={handleDeleteChat}
          />
        </div>
      )}
    </>
  );
}

export default Sidebar;
