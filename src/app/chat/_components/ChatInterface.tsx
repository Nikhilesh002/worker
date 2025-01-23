"use client";

import React, { useState } from "react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import InitialChatInterface from "./InitialChatInterface";

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

  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  return <div>ChatInterface for {chatId}</div>;
}

export default ChatInterface;
