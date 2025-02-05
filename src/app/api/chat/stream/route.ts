import {
  IChatRequestBody,
  IMessage,
  IStreamMessage,
  IStreamMessageType,
} from "@/lib/types";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "../../../../../convex/convex";
import {
  SSE_DATA_DELIMITER,
  SSE_DATA_PREFIX,
  SSE_DONE_MESSAGE,
} from "../../../../../constants/constants";
import { api } from "../../../../../convex/_generated/api";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { submitQuestion } from "@/lib/langgraph";

const sendSSEMessage = async (
  writer: WritableStreamDefaultWriter<Uint8Array>,
  message: IStreamMessage
) => {
  const encoder = new TextEncoder();
  return writer.write(
    encoder.encode(
      `${SSE_DATA_PREFIX}${JSON.stringify(message)}${SSE_DATA_DELIMITER}`
    )
  );
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId, messages, newMessage } =
      (await req.json()) as IChatRequestBody;

    // if (!chatId || !messages || !newMessage) {
    //   return NextResponse.json(
    //     { error: "Missing required fields" },
    //     { status: 400 }
    //   );
    // }

    const convex = await getConvexClient();

    // create stream with larger queue stratagy for greater throughput
    const stream = new TransformStream({}, { highWaterMark: 1024 });
    const writer = stream.writable.getWriter();

    const resp = new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        connction: "keep-alive",
        "X-Accel-Buffering": "no", // disable buffering for nginx which is req for SSE to work properly
      },
    });

    const streamMessage = async () => {
      try {
        // send initial connected message
        await sendSSEMessage(writer, { type: IStreamMessageType.Connected });

        // store user's newMessage in db
        await convex.mutation(api.messages.sendMessage, {
          chatId,
          content: newMessage,
        });

        // convert messages to Langchain format
        const prevLangchainMessages = messages.map((msg: IMessage) => {
          if (msg.role === "user") {
            return new HumanMessage(msg.content);
          }
          return new AIMessage(msg.content);
        });

        const langchainMessages = [
          ...prevLangchainMessages,
          new HumanMessage(newMessage),
        ];

        try {
          // create stream
          const eventStream = await submitQuestion(langchainMessages, chatId);

          // we r now getting stream of chunks from langgraph
          for await (const event of eventStream) {
            console.log(event);
            if (event.event === "on_chat_model_stream") {
              const token = event.data.chunk;

              if (token) {
                const textContent = token.content.at(0)?.["text"];

                if (textContent) {
                  await sendSSEMessage(writer, {
                    type: IStreamMessageType.Token,
                    token: textContent,
                  });
                }
              }
            } else if (event.event === "on_tool_start") {
              await sendSSEMessage(writer, {
                type: IStreamMessageType.ToolStart,
                tool: event.name || "unknown",
                input: event.data.input,
              });
            } else if (event.event === "on_tool_end") {
              const toolMessage = new ToolMessage(event.data.output);

              await sendSSEMessage(writer, {
                type: IStreamMessageType.ToolEnd,
                tool: toolMessage.lc_kwargs.name || "unknown",
                output: event.data.output,
              });
            }
          }

          // send completion msg without storing resp
          await sendSSEMessage(writer, { type: IStreamMessageType.Done, message: SSE_DONE_MESSAGE });
        } catch (streamError) {
          console.error("Error in streaming", streamError);
          await sendSSEMessage(writer, {
            type: IStreamMessageType.Error,
            error:
              streamError instanceof Error
                ? streamError.message
                : "Streaming failed",
          });
        }
      } catch (error) {
        console.error("Error with stream", error);
        await sendSSEMessage(writer, {
          type: IStreamMessageType.Error,
          error: error instanceof Error ? error.message : "API error",
        });
      } finally {
        try {
          await writer.close();
        } catch (error) {
          console.error("Error closing write: ", error);
        }
      }
    };
    streamMessage();

    return resp;
  } catch (error) {
    console.error("Error with LLM", error);
    return NextResponse.json({ error: "Error with LLM" }, { status: 500 });
  }
}
