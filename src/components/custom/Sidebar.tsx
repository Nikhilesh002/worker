import { NavigationContext } from "@/lib/NavigationContextProvider";
import { useRouter } from "next/navigation";
import React, { use, useState } from "react";
import { Button } from "../ui/button";
import { Menu, Plus } from "lucide-react";
import { Chat } from "@/lib/types";
import { Separator } from "../ui/separator";
import Link from "next/link";

function Sidebar() {
  const router = useRouter();
  const { isMobileNavOpen, closeMobileNav } = use(NavigationContext);

  const [chats, setChats] = useState<Chat[]>([]);

  const handleNewChatClick = () => {
    // router.push("/chat/new");
    console.log("New Chat");
    console.log(isMobileNavOpen);
    setChats([
      {
        id: "1",
        name: "Chat 1 wajewbgrg iuegtierug ",
      },
      {
        id: "2",
        name: "Chat 2",
      },
      {
        id: "3",
        name: "Chat 3",
      },
    ]);
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
        <div className="h-full w-64 text-white text-center space-y-6">
          <div className="space-y-4 mt-4">
            <div className="flex ps-1 ">
              <Button variant={"ghost"} onClick={closeMobileNav}>
                <Menu />
              </Button>
            </div>
            <h1 className="text-white text-xl font-bold font-serif">
              Your Chats
            </h1>
            <Button onClick={handleNewChatClick}>
              New Chat <Plus />
            </Button>
          </div>

          <Separator />

          <div className="">
            {chats.length === 0 ? (
              <div className="txt">No chats to display</div>
            ) : (
              <div className="space-y-2 mt-2 text-center">
                {chats.map((chat) => (
                  <Link
                    href={`/chat/${chat.id}`}
                    key={chat.id}
                    className="flex items-center justify-between px-3 py-1"
                  >
                    <Button variant="outline" className="w-full bg-gray-900">
                      <p className="text-sm font-thin">
                        {chat.name.length > 25
                          ? chat.name.substring(0, 25) + "..."
                          : chat.name}
                      </p>
                    </Button>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
