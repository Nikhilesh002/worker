export const keyDownHandler = (e: React.KeyboardEvent<HTMLTextAreaElement>, funToBeCalled: () => void) => {
  if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    funToBeCalled();
  }
};

export const processStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (chunk: string) => Promise<void>
) => {
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await onChunk(new TextDecoder().decode(value));
    }
  } finally {
    reader.releaseLock();
  }
};
