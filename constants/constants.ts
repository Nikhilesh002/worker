export const functionalities = [
  {
    name: "Ask about React",
    color: "blue-400",
  },
  {
    name: "Latest news online",
    color: "orange-400",
  },
  {
    name: "Transcribe a youtube video",
    color: "lime-400",
  },
  {
    name: "Todays weather",
    color: "red-400",
  }
];


export const SSE_DATA_PREFIX = "data: " as const;
export const SSE_DONE_MESSAGE = "[DONE]" as const;
export const SSE_DATA_DELIMITER = "\n\n" as const;