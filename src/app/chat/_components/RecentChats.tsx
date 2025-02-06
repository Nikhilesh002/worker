import { Trash2 } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function RecentChats({
  chats,
  handleDeleteChat,
}: {
  chats: Doc<"chats">[];
  handleDeleteChat: (_id: Id<"chats">) => void;
}) {
  return (
    <div className="">
      {chats ? (
        chats.length === 0 ? (
          <p>No chats to display</p>
        ) : (
          <div className="space-y-2 mt-2 text-center">
            {chats.map((chat) => (
              <div
                key={chat._id}
                className="flex items-center justify-between bg-gray-900 px-3 py-1 w-full"
              >
                <div className="w-full pe-2">
                  <Link
                    href={`/chat/${chat._id}`}
                    key={chat._id}
                    className="flex flex-col items-center justify-between px-1 py-1"
                  >
                    <p className=" font-thin">
                      {chat.title.length > 20
                        ? chat.title.substring(0, 20) + "..."
                        : chat.title}
                    </p>
                    <p className="text-[12px] text-gray-400">
                      {/* {new Date(Date.now() - new Date(chat._creationTime))} */}
                      {new Date(chat._creationTime).toLocaleString()}
                    </p>
                  </Link>
                </div>
                <button
                  className="hover:text-red-400"
                  // onClick={() => handleDeleteChat(chat._id)}
                >
                  <AlertDialog>
                    <AlertDialogTrigger>
                      <Trash2 />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete your account and remove your data from our
                          servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {console.log("hi not deleted")}}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteChat(chat._id)}>Continue</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
