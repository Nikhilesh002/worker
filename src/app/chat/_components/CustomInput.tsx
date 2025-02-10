"use client";

import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import React, { useState } from "react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

function CustomInput({
  chatId,
  messages,
  setMessages,
}: {
  chatId: Id<"chats">;
  messages: Doc<"messages">[];
  setMessages: React.Dispatch<React.SetStateAction<Doc<"messages">[]>>;
}) {
  const [inputValue, setInputValue] = useState("");

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
          <p className="text-xs text-gray-400">Powered by LLM</p>
          <button
            // onClick={handleSubmit}
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
