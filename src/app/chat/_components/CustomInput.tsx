"use client";

import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import React, { use, useState } from "react";
import { useRouter } from "next/navigation";
import { NavigationContext } from "@/components/NavigationContext/NavigationContextProvider";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

function CustomInput() {
  const [inputValue, setInputValue] = useState("");

  const router = useRouter();
  const { closeMobileNav } = use(NavigationContext);

  const createChat = useMutation(api.chats.createChat);

  const handleNewChatClick = async () => {
    const newChatId = await createChat({ title: "New Chat" });
    router.push(`/chat/${newChatId}`);
    closeMobileNav();
  };

  return (
    <div className="w-full">
      <div className="w-full border-l-2 border-r-[5px] border-b-[5px] border-t-[2px] border-orange-200 rounded-lg px-[10px]">
        <Textarea
          // onKeyDown={keyDownHandler}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
          placeholder="Type here"
          rows={3}
          className="font-serif border border-gray-600"
        />
        <div className="flex justify-between items-center py-2">
          <p className="text-xs text-gray-400">Powered by Gemini</p>
          <button
            onClick={handleNewChatClick}
            disabled={!inputValue.trim()}
            className={`rounded-full ${
              inputValue.trim()
                ? "bg-white text-black"
                : "bg-gray-500 text-gray-200"
            }`}
          >
            <ArrowUp />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomInput;
