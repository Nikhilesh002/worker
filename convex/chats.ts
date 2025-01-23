import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const checkAuth = async (ctx: any) => {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    return identity;
  } catch (error: any) {
    throw new Error(`Authentication error: ${error.message}`);
  }
};

export const createChat = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const identity = await checkAuth(ctx);
      const chatId = await ctx.db.insert("chats", {
        title: args.title,
        userId: identity.subject,
        createdAt: Date.now(),
      });
      return chatId;
    } catch (error: any) {
      throw new Error(`Failed to create chat: ${error.message}`);
    }
  },
});

export const deleteChat = mutation({
  args: {
    id: v.id("chats"),
  },
  handler: async (ctx, args) => {
    try {
      const identity = await checkAuth(ctx);
      const chat = await ctx.db.get(args.id);

      if (!chat) {
        throw new Error("Chat not found");
      }

      if (chat.userId !== identity.subject) {
        throw new Error("Unauthorized");
      }

      // delete all messages in chat
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chatId", (q) => q.eq("chatId", args.id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // delete chat
      await ctx.db.delete(args.id);
    } catch (error: any) {
      throw new Error(`Failed to delete chat: ${error.message}`);
    }
  },
});

export const listChats = query({
  handler: async (ctx) => {
    try {
      const identity = await checkAuth(ctx);
      return await ctx.db
        .query("chats")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .order("desc")
        .collect();
    } catch (error: any) {
      throw new Error(`Failed to list chats: ${error.message}`);
    }
  },
});
