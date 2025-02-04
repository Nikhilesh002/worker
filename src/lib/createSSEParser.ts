import { IStreamMessageType, IStreamMessage } from "./types";
import { SSE_DONE_MESSAGE, SSE_DATA_PREFIX } from "./../../constants/constants";

// create parser for SSE streams
export function createSSEParser() {
  let buffer = "";

  const parse = (chunk: string): IStreamMessage[] => {
    // append chunk to buffer and split into lines
    const lines = (buffer + chunk).split("\n");

    // set last line, if no line exists, set ""
    buffer = lines.pop() || "";

    return lines
      .map((line) => {
        const trimmedLine = line.trim();

        // if line is empty or not in expected format, return null
        if (!trimmedLine || !trimmedLine.startsWith(SSE_DATA_PREFIX))
          return null;

        const msg = trimmedLine.replace(SSE_DATA_PREFIX, "");

        // if msg is done message, return done message
        if (msg === SSE_DONE_MESSAGE) {
          return { type: IStreamMessageType.Done };
        }

        try {
          const parsed = JSON.parse(msg) as IStreamMessage;
          return Object.values(IStreamMessageType).includes(parsed.type)
            ? parsed
            : null;
        } catch (error) {
          return {
            type: IStreamMessageType.Error,
            error: "Failed to parse SSE message",
          };
        }
      })
      .filter((msg): msg is IStreamMessage => msg !== null);
  };

  return { parse };
}
