import { ConvexHttpClient } from "convex/browser";

export const getConvexClient = async () => {
  console.log(process.env.NEXT_PUBLIC_CONVEX_URL);
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");
};
