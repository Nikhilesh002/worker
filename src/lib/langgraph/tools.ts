import { ToolNode } from "@langchain/langgraph/prebuilt";
import wxflows from "@wxflows/sdk/langchain";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// connect to wxflows
const toolClient = new wxflows({
  endpoint: process.env.WXFLOWS_ENDPOINT || "",
  apikey: process.env.WXFLOWS_APIKEY || "",
  flowName: "workerAI",
});

// const ytTranscript = tool(
//   async ({ langCode, videoUrl }) => {
//     const resp = await fetch("https://tactiq-apps-prod.tactiq.io/transcript", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         url: videoUrl,
//         langCode,
//       }),
//     }).then((res) => res.json());
//     console.log({ resp });
//     return resp;
//   },
//   {
//     name: "ytTranscript",
//     description:
//       "Retrieve transcripts for a given YouTube video. The videoUrl should be in the format https://www.youtube.com/watch?v=VIDEO_ID",
//     schema: z.object({
//       videoUrl: z.string().describe("The video url to use in your search."),
//       langCode: z.string().describe("The langCode to use in your search."),
//     }),
//   }
// );

const getAllCustomers = tool(async () => {
  const resp = await fetch("https://introspection.apis.stepzen.com/customers",{
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());
  // console.log({ resp });
  return resp;
}, {
  name: "getAllCustomers",
  description:
    "Retrieve all customers' information including their address and order history. Return customer details, including name, address, and past orders with shipping details.",
});

const getCustomerById = tool(async ({id}) => {
  const resp = await fetch(`https://introspection.apis.stepzen.com/customers/${id}`,{
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());
  // console.log({ resp });
  return resp;
}, {
  name: "getCustomerById",
  description:
    "Retrieve specific customer information including their address and order history. Return customer details, including name, address, and past orders with shipping details. To search for a specific customer with id: 1, use curl url followed by /1 i.e: https://api.example.com/customers/1",
  schema: z.object({
    id: z.string().describe("The customer id to use in your search."),
  })
});

// retrieve tools
export const tools = [getAllCustomers, getCustomerById];
export const toolNode = new ToolNode(tools);
