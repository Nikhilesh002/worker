import { ToolNode } from "@langchain/langgraph/prebuilt";
import wxflows from "@wxflows/sdk/langchain";

// customers at: https://introspection.apis.stepzen.com/customers
// coments at: https://dummyjson.com/comments

// connect to wxflows
const toolClient = new wxflows({
  endpoint: process.env.WXFLOWS_ENDPOINT ?? "",
  apikey: process.env.WXFLOWS_API_KEY ?? "",
  flowName: "workerAI",
});

// retrieve tools
export const tools = await toolClient.lcTools;
export const toolNode = new ToolNode(tools);
