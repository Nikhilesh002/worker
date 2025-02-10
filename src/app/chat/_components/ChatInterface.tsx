"use client";

import React, { useEffect, useRef, useState } from "react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Textarea } from "@/components/ui/textarea";
import { IChatRequestBody, IMessage, IStreamMessageType } from "@/lib/types";
import { createSSEParser } from "@/lib/createSSEParser";
import { ArrowUp } from "lucide-react";
import { keyDownHandler, processStream } from "./lib/chatInterface";
import { getConvexClient } from "../../../../convex/convex";
import { api } from "../../../../convex/_generated/api";
import { formatTerminalOutput } from "./lib/formatTerminalOutput";
import MessageBubble from "./MessageBubble";
import { functionalities } from "../../../../constants/constants";

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

    // setInputValue("");
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
          "Content-Type": "text/event-stream",
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
        // console.log({ receivedMessages, currentTool });

        for (const msg of receivedMessages) {
          switch (msg.type) {
            case IStreamMessageType.Token:
              if ("token" in msg) {
                aiResponse += msg.token;
                setStreamedResponse(aiResponse);
              }
              break;

            case IStreamMessageType.ToolStart:
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
              break;

            case IStreamMessageType.ToolEnd:
              if (currentTool) {
                // replace last processing... message with actual tool o/p
                const lastTerminalIdx = aiResponse.lastIndexOf(`---START---`);

                if (lastTerminalIdx !== -1) {
                  aiResponse =
                    aiResponse.slice(0, lastTerminalIdx) +
                    formatTerminalOutput({
                      toolName: currentTool.name,
                      input: currentTool.input,
                      output: msg.output,
                    });
                } else {
                  aiResponse = aiResponse.replace(
                    "Processing...",
                    JSON.stringify(msg.output, null, 2)
                  );
                }

                setStreamedResponse(aiResponse);
                setCurrentTool(null);
              }
              break;

            case IStreamMessageType.Done:
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
              break;

            case IStreamMessageType.Error:
              if (IStreamMessageType.Error in msg) {
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
    <main className="z-10 flex flex-col justify-center items-center mx-auto h-[calc(100vh-theme(spacing.20))]">
      <section className="w-full flex flex-col items-center overflow-y-auto no-scrollbar rounded-b-lg">
        <div className="w-1/2">
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
        </div>
        <div ref={messageEndRef}></div>
      </section>

      <div className="w-1/2 mt-2 border-l-2 border-r-[5px] border-b-[5px] border-t-[2px] border-orange-200 rounded-lg px-[10px]">
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
        {
          messages.length===0 && streamedResponse==="" && <div className="mt-3 flex space-x-5 text-[12px] justify-center">
          {functionalities.map((fun, i) => (
            <div key={i} className={`border border-${fun.color} rounded`}>
              <p className={`text-${fun.color} px-1 py-0.5`}>{fun.name}</p>
            </div>
          ))}
        </div>
        }
    </main>
  );
}

export default ChatInterface;
