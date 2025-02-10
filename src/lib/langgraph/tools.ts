import { ToolNode } from "@langchain/langgraph/prebuilt";
// import wxflows from "@wxflows/sdk/langchain";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// connect to wxflows
// const toolClient = new wxflows({
//   endpoint: process.env.WXFLOWS_ENDPOINT || "",
//   apikey: process.env.WXFLOWS_APIKEY || "",
//   flowName: "workerAI",
// });

const getAllCustomers = tool(
  async () => {
    const resp = await fetch(
      "https://introspection.apis.stepzen.com/customers",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    ).then((res) => res.json());

    return resp;
  },
  {
    name: "getAllCustomers",
    description:
      "Retrieve all customers' information including their address and order history. Return customer details, including name, address, and past orders with shipping details.",
  }
);

const getCustomerById = tool(
  async ({ id }) => {
    const resp = await fetch(
      `https://introspection.apis.stepzen.com/customers/${id}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    ).then((res) => res.json());

    return resp;
  },
  {
    name: "getCustomerById",
    description:
      "Retrieve specific customer information including their address and order history. Return customer details, including name, address, and past orders with shipping details. To search for a specific customer with id: 1, use curl url followed by /1 i.e: https://api.example.com/customers/1",
    schema: z.object({
      id: z.string().describe("The customer id to use in your search."),
    }),
  }
);

// retrieve tools
export const tools = [getAllCustomers, getCustomerById];
export const toolNode = new ToolNode(tools);
