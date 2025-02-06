import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkAuth } from "./chats";

const SHOW_COMMENTS = false;

export const listMessages = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    try {
      // const identity = await checkAuth(ctx);

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
        .order("asc")
        .collect();

      if (SHOW_COMMENTS) {
        console.log("messages", messages);
      }

      return messages;
    } catch (error) {
      console.error("Error in listMessages:", error);
      throw error;
    }
  },
});

export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // const identity = await checkAuth(ctx);

      const messageId = await ctx.db.insert("messages", {
        chatId: args.chatId,
        content: args.content,
        role: "user",
        createdAt: Date.now(),
      });

      return messageId;
    } catch (error) {
      console.error("Error in sendMessage:", error);
      throw error;
    }
  },
});

export const storeMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      // const identity = await checkAuth(ctx);

      const messageId = await ctx.db.insert("messages", {
        chatId: args.chatId,
        content: args.content,
        role: args.role,
        createdAt: args.createdAt,
      });

      return messageId;
    } catch (error) {
      console.error("Error in storeMessage:", error);
      throw error;
    }
  },
});

export const getLastMessage = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    try {
      const identity = await checkAuth(ctx);

      const message = await ctx.db
        .query("messages")
        .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
        .order("desc")
        .first();

      return message;
    } catch (error) {
      console.error("Error in getLastMessage:", error);
      throw error;
    }
  },
});
