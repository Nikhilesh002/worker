"use client";

import React, { useEffect, useRef, useState } from "react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import InitialChatInterface from "./InitialChatInterface";
import CustomInput from "./CustomInput";

function ChatInterface({
  chatId,
  initialMessages,
}: {
  chatId: Id<"chats">;
  initialMessages: Doc<"messages">[];
}) {
  // if (initialMessages.length === 0) {
  //   return <InitialChatInterface />;
  // }

  // atleast 1 prev chat

  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // if u get new msg then scroll to bottom
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <main className="w-1/2 flex flex-col mx-auto h-[calc(100vh-theme(spacing.20))]">
      <section className="flex-1">
        <div ref={messageEndRef} />
      </section>

      <div></div>

      <CustomInput />
    </main>
  );
}

export default ChatInterface;
