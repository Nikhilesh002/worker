import { ConvexHttpClient } from "convex/browser";

export const getConvexClient = async () => {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");
};
