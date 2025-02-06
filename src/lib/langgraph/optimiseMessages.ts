import { BaseMessage } from "@langchain/core/messages";

// const addCachingHeaders = (messages: BaseMessage[]): BaseMessage[] => {
//   // Rules of caching
//   // 1. cache system prompt
//   // 2. cache last msg (AIMsg)
//   // 3. cache last 2nd HumanMsg

//   return messages;
// };

const summariseMessages = (messages: BaseMessage[]): BaseMessage[] => {
  // Rules of summarisation
  // 1. if len<6 return messages
  // 2. else summarize

  return messages;
};

export const optimiseMessages = (messages: BaseMessage[]): BaseMessage[] => {
  const summarisedMessages = summariseMessages(messages);
  // const cachedMessages = addCachingHeaders(messages);

  return summarisedMessages;
};
