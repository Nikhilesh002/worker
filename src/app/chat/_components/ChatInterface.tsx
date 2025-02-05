"use client";

import React, { useEffect, useRef, useState } from "react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import InitialChatInterface from "./InitialChatInterface";
import { Textarea } from "@/components/ui/textarea";
import { IChatRequestBody, IMessage, IStreamMessageType } from "@/lib/types";
import { createSSEParser } from "@/lib/createSSEParser";
import { ArrowUp } from "lucide-react";
import { keyDownHandler, processStream } from "./lib/chatInterface";
import { getConvexClient } from "../../../../convex/convex";
import { api } from "../../../../convex/_generated/api";
import { formatTerminalOutput } from "./lib/formatTerminalOutput";
import MessageBubble from "./MessageBubble";

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
  const [loading, setLoading] = useState(false);

  const [inputValue, setInputValue] = useState("");
  const [streamedResponse, setStreamedResponse] = useState<string>("");
  const [currentTool, setCurrentTool] = useState<{
    name: string;
    input: unknown;
  } | null>(null);

  // if u get new msg then scroll to bottom
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSubmit = async () => {
    const trimmedInput = inputValue.trim();

    if (trimmedInput === "" || loading) return;

    // TODO setInputValue("");
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

    try {
      // save in db
      const convex = await getConvexClient();
      await convex.mutation(api.messages.storeMessage, {
        chatId,
        content: trimmedInput,
        role: "user",
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error(error);
    }

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

      if (!resp.ok) throw new Error(resp.statusText);
      if (!resp.body) throw new Error("No response body");

      // handle stream
      // create SSE parser and stream reader
      const parser = createSSEParser();
      const reader = resp.body.getReader();

      //
      await processStream(reader, async (chunk) => {
        const receivedMessages = parser.parse(chunk);

        for (let msg of receivedMessages) {
          switch (msg.type) {
            case IStreamMessageType.Token:
              if (IStreamMessageType.Token in msg) {
                aiResponse += msg.token;
                setStreamedResponse(aiResponse);
              }
              break;

            case IStreamMessageType.ToolStart:
              if (IStreamMessageType.ToolStart in msg) {
                setCurrentTool({
                  input: msg.input,
                  name: msg.tool,
                });
                aiResponse += formatTerminalOutput({
                  toolName: msg.tool,
                  input: msg.input,
                  output: "Processing...",
                });
                setStreamedResponse(aiResponse);
              }
              break;

            case IStreamMessageType.ToolEnd:
              if (IStreamMessageType.ToolEnd in msg && currentTool) {
                // replace last processing... message with actual tool o/p
                const lastTerminalIdx = aiResponse.lastIndexOf(
                  `<div class="big-[#1e1e1e]"`
                );

                if (lastTerminalIdx !== -1) {
                  aiResponse =
                    aiResponse.slice(0, lastTerminalIdx) +
                    formatTerminalOutput({
                      toolName: msg.tool,
                      input: currentTool.input,
                      output: msg.output,
                    });
                  setStreamedResponse(aiResponse);
                }
                setCurrentTool(null);
              }
              break;

            case IStreamMessageType.Done:
              if (IStreamMessageType.Done in msg) {
                const aiMessage = {
                  _id: `temp_assistant_${Date.now()}` as Id<"messages">,
                  chatId: chatId as string,
                  content: aiResponse,
                  createdAt: Date.now(),
                  role: "assistant" as const,
                  _creationTime: Date.now(),
                };
                setMessages((prev) => [...prev, aiMessage]);

                try {
                  // save in db
                  const convex = await getConvexClient();
                  await convex.mutation(api.messages.storeMessage, {
                    chatId,
                    content: aiResponse,
                    role: "assistant",
                    createdAt: Date.now(),
                  });

                  setLoading(false);
                  setStreamedResponse("");
                } catch (error) {
                  console.error(error);
                }
              }
              break;

            case IStreamMessageType.Error:
              if (IStreamMessageType.Error in msg) {
                console.log("hola wesrgdthfyu");
                throw new Error();
              }
              break;
          }
        }
      });
    } catch (error) {
      console.error("Error with AI:", error);

      try {
        // save in db
        const convex = await getConvexClient();
        await convex.mutation(api.messages.storeMessage, {
          chatId,
          content: "Failed to process request. Please try again.",
          role: "assistant",
          createdAt: Date.now(),
        });

        setLoading(false);
        setStreamedResponse("");
      } catch (error) {
        console.error(error);
      }

      setMessages((prev) => [
        ...prev,
        {
          _creationTime: Date.now(),
          _id: `temp_assistant_${Date.now()}` as Id<"messages">,
          chatId,
          content: "Failed to process request. Please try again.",
          createdAt: Date.now(),
          role: "assistant",
        },
      ]);

      // remove optimistically added msg
      // setMessages((prev) =>
      //   prev.filter((msg) => msg._id !== optimisticUserMessage._id)
      // );

      // setStreamedResponse(
      //   formatTerminalOutput({
      //     toolName: "Error",
      //     input: "Failed to process request",
      //     output: error instanceof Error ? error.message : "Unknown error",
      //   })
      // );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-1/2 flex flex-col mx-auto h-[calc(100vh-theme(spacing.20))]">
      <section className="flex-1">
        {messages.map((message) => (
          <MessageBubble
            key={message._id}
            content={message.content}
            isUser={message.role === "user"}
          />
        ))}

        {streamedResponse && (
          <MessageBubble content={streamedResponse} isUser={false} />
        )}

        {loading && <div className="animate-pulse">loading...</div>}
        <div ref={messageEndRef} />
      </section>

      <div></div>

      <div className="w-full border-l-2 border-r-[5px] border-b-[5px] border-t-[2px] border-orange-200 rounded-lg px-[10px]">
        <Textarea
          onKeyDown={(e) => keyDownHandler(e, handleSubmit)}
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
    </main>
  );
}

export default ChatInterface;
