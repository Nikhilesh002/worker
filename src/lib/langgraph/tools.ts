import { ToolNode } from "@langchain/langgraph/prebuilt";
import wxflows from "@wxflows/sdk/langchain";

// connect to wxflows
const toolClient = new wxflows({
  endpoint: process.env.WXFLOWS_ENDPOINT || "",
  apikey: process.env.WXFLOWS_APIKEY || "",
  flowName: "workerAI",
});

// retrieve tools
export const tools = await toolClient.lcTools;
export const toolNode = new ToolNode(tools);
