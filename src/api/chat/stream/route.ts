import {
  IChatRequestBody,
  IMessage,
  IStreamMessage,
  IStreamMessageType,
} from "@/lib/types";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "../../../../convex/convex";
import {
  SSE_DATA_DELIMITER,
  SSE_DATA_PREFIX,
} from "../../../../constants/constants";
import { api } from "../../../../convex/_generated/api";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { submitQuestion } from "@/lib/langgraph";

const sendSSEMessage = (
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

    if (!chatId || !messages || !newMessage) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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
        // stream

        // send initial connected message
        await sendSSEMessage(writer, { type: IStreamMessageType.Connected });
      } catch (error) {
        console.error("Error with LLM", error);
        return NextResponse.json({ error: "Error with LLM" }, { status: 500 });
      }

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
        const eventStream = await submitQuestion(langchainMessages,chatId);

        // we r now getting stream of chunks from langgraph
        for await (const event of eventStream){
          console.log(event)
        }
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
    };
  } catch (error) {
    console.error("Error with stream", error);
    await sendSSEMessage(writer,{
      type: IStreamMessageType.Error,
      error: error instanceof Error ? error.message : "API error",
    })
  }
}
