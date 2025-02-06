import { IStreamMessageType, IStreamMessage } from "./types";
import { SSE_DATA_PREFIX } from "./../../constants/constants";

// create parser for SSE streams
export const createSSEParser = () => {
  let buffer = "";

  const parse = (chunk: string): IStreamMessage[] => {
    // Append chunk to buffer and split into lines
    const lines = (buffer + chunk).split("\n\n");

    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || "";

    const extractedMessages: IStreamMessage[] = [];

    for (let line of lines) {
      // Remove extra backslashes added before quotes
      line = line.replace(/\\(?=["'])/g, "");

      const trimmedLine = line.trim();
      console.log({ trimmedLine });

      // Skip empty or invalid lines
      if (!trimmedLine || !trimmedLine.startsWith(SSE_DATA_PREFIX)) continue;

      // Extract the actual message content
      const msg = trimmedLine.slice(SSE_DATA_PREFIX.length, trimmedLine.length);

      console.log({ msg });

      try {
        // Parse the JSON message correctly
        const parsed = JSON.parse(msg);

        // Validate the message type
        if (Object.values(IStreamMessageType).includes(parsed.type)) {
          extractedMessages.push(parsed);
        } else throw new Error();
      } catch (error) {
        extractedMessages.push({
          type: IStreamMessageType.Error,
          error: error instanceof Error ? error.message : "Error parsing SSE",
        });
      }
    }

    return extractedMessages;
  };

  return { parse };
};
