"use client";

import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import React, { useState } from "react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import { IChatRequestBody, IMessage } from "@/lib/types";

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
  const [loading, setLoading] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState<string>("");
  const [currentTool, setCurrentTool] = useState<{
    name: string;
    input: unknown;
  } | null>(null);

  const handleSubmit = async () => {
    const trimmedInput = inputValue.trim();

    if (trimmedInput === "" || loading) return;

    setInputValue("");
    setStreamedResponse("");
    setCurrentTool(null);
    setLoading(true);

    // optimistic UI (add immediately)
    const optimisticUserMessage: Doc<"messages"> = {
      _id: `temp_${Date.now()}` as Id<"messages">,
      chatId,
      content: trimmedInput,
      role: "user",
      createdAt: Date.now(),
      _creationTime: Date.now(),
    } as Doc<"messages">;

    setMessages((prev) => [...prev, optimisticUserMessage]);

    let aiResponse = "";

    // start streaming
    try {
      const reqBody: IChatRequestBody = {
        messages: messages.map((msg: IMessage) => ({
          role: msg.role,
          content: msg.content,
        })),
        newMessage: trimmedInput,
        chatId,
      };

      // initialize SSE conn (Server-sent Events)
      const resp = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
      });

      if (!resp.ok)  throw new Error(resp.statusText);
      if(!resp.body) throw new Error("No response body");

      // handle stream


    } catch (error) {
      console.error("Error with AI:", error);
      // remove optimistically added msg
      setMessages(
        (prev) => prev.filter((msg) => msg._id !== optimisticUserMessage._id)
      );
      setLoading(false);
      setStreamedResponse("Error occurred. Please try again.");
    }

    setLoading(false);
  };

  const keyDownHandler = (e: any) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full">
      <div className="w-full border-l-2 border-r-[5px] border-b-[5px] border-t-[2px] border-orange-300 rounded-lg px-[10px]">
        <Textarea
          onKeyDown={keyDownHandler}
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
            onClick={handleSubmit}
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
