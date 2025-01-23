import { Trash2 } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Doc } from "../../../../convex/_generated/dataModel";

function RecentChats({
  chats,
  handleDeleteChat,
}: {
  chats: Doc<"chats">[];
  handleDeleteChat: (_id: string) => void;
}) {
  return (
    <div className="">
      {chats ? (
        chats.length === 0 ? (
          <p>No chats to display</p>
        ) : (
          <div className="space-y-2 mt-2 text-center">
            {chats.map((chat) => (
              <div className="flex items-center justify-between bg-gray-900 px-3 py-1 w-full">
                <div className="flex flex-col">
                  <Link
                    href={`/chat/${chat._id}`}
                    key={chat._id}
                    className="flex items-center justify-between px-1 py-1"
                  >
                    <p className=" font-thin">
                      {chat.title.length > 20
                        ? chat.title.substring(0, 20) + "..."
                        : chat.title}
                    </p>
                  </Link>
                  <p className="text-[12px] text-gray-400">
                    {/* {new Date(Date.now() - new Date(chat._creationTime))} */}
                    {new Date(chat._creationTime).toLocaleString()}
                  </p>
                </div>
                <button
                  className="hover:text-red-400"
                  onClick={() => handleDeleteChat(chat._id)}
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

export default RecentChats;
