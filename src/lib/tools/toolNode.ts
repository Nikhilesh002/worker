import { ToolNode } from "@langchain/langgraph/prebuilt";
import * as myTools from "./tools";

// retrieve tools
// export const tools : DynamicTool[] = Object.values(myTools);
export const tools = [myTools.getSystemDateTime, myTools.listMyTools]
export const toolNode = new ToolNode(tools);

export const toolNames = Object.keys(myTools);