import { ToolNode } from "@langchain/langgraph/prebuilt";
import * as myTools from "./tools";

// retrieve tools
export const tools = Object.values(myTools);
export const toolNode = new ToolNode(tools);
