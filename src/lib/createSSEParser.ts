import { IStreamMessageType, IStreamMessage } from "./types";
import {
  SSE_DATA_PREFIX,
  SSE_DATA_DELIMITER,
} from "./../../constants/constants";

// create parser for SSE streams
export const createSSEParser = () => {
  // very good way, this will give buffer to each of the functin call
  // each function call will create its own ind buffer.
  let buffer = "";

  const parse = (chunk: string): IStreamMessage[] => {
    // append chunk to buffer and split into lines
    const lines = (buffer + chunk).split("\n");

    // set last line, if no line exists, set ""
    buffer = lines.pop() || "";

    const extractedMessaages: IStreamMessage[] = [];

    for (let line of lines) {
      const trimmedLine = line.trim();
      // data: the_actual_content\n\n
      // prefix the_actual_content(nothing)delimiter

      // if line is empty or not in expected format, return null
      if (!trimmedLine || !trimmedLine.startsWith(SSE_DATA_PREFIX)) continue;

      const msg = trimmedLine.slice(
        SSE_DATA_PREFIX.length,
        trimmedLine.length - SSE_DATA_DELIMITER.length
      );

      try {
        const parsed = JSON.parse(msg) as IStreamMessage;
        if (Object.values(IStreamMessageType).includes(parsed.type)) {
          extractedMessaages.push(parsed);
        } else throw new Error();
      } catch (error) {
        extractedMessaages.push({
          type: IStreamMessageType.Error,
          error: "Failed to parse SSE message",
        });
      }
    }

    return extractedMessaages;
  };

  return { parse };
};
