import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as math from "mathjs";

export const getCustomerById = tool(
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

export const getSystemDateTime = tool(
  ()=>{
    return Date.now().toString()
  },
  {
    name: "getSystemDateTime",
    description:"get system date and time in --Tue Aug 19 1975 23:15:30 GMT+0200 (CEST)-- example format"
  }
)

export const currencyConverter = tool(
  async ({ amount, from, to, date }) => {
    from = from.toLowerCase();
    to = to.toLowerCase();

    const resp = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${from}.json`
    ).then((res) => res.json());
    return { result: amount * resp[from][to], currency: to };
  },
  {
    name: "currencyConverter",
    description:
      "Convert between world currencies using real-time exchange rates",
    schema: z.object({
      amount: z.number().describe("The amount to convert"),
      from: z.string().describe("Base currency code (e.g., USD)"),
      to: z.string().describe("Target currency code (e.g., EUR)"),
      date: z
        .string()
        .describe(
          "Date on which you want to convert currency in YYYY-MM-DD format"
        ),
    }),
  }
);

export const scientificCalculator = tool(
  async ({ expression }) => {
    return { result: math.evaluate(expression) };
  },
  {
    name: "scientificCalculator",
    description:
      "Advanced math operations including algebra, calculus, and statistics using mathjs npm package",
    schema: z.object({
      expression: z
        .string()
        .describe("Mathematical expression in mathjs format to evaluate"),
    }),
  }
);

export const npmPackageSuggestions = tool(
  async ({ keyword }) => {
    return fetch(`https://www.npmjs.com/search/suggestions?q=${keyword}`).then(
      (res) => res.json()
    );
  },
  {
    name: "npmPackageSuggestions",
    description: "Get NPM packages related to your search word",
    schema: z.object({
      keyword: z.string().describe("keyword to search npm registry"),
    }),
  }
);

export const npmPackageLookup = tool(
  async ({ name }) => {
    return fetch(`https://registry.npmjs.org/${name}`).then((res) =>
      res.json()
    );
  },
  {
    name: "npmPackageLookup",
    description: "Get detailed information about NPM packages",
    schema: z.object({
      name: z.string().describe("Package name to look up"),
    }),
  }
);

export const translateText = tool(
  async ({ text, target }) => {
    const res = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: target,
      }),
    });
    return res.json();
  },
  {
    name: "translateText",
    description: "Translate text between 100+ languages",
    schema: z.object({
      text: z.string().describe("Text to translate"),
      target: z.string().describe("Target language code (e.g., es, fr)"),
    }),
  }
);

export const dockerImageScanner = tool(
  async ({ image }) => {
    return fetch(`https://hub.docker.com/v2/repositories/${image}/tags/`, {
      headers: {
        "X-Docker-Token": "true",
      },
    }).then((res) => res.json());
  },
  {
    name: "dockerImageScanner",
    description: "Get Docker image metadata and vulnerability reports",
    schema: z.object({
      image: z.string().describe("Image name (e.g., library/nginx)"),
    }),
  }
);

export const stackoverflowSearch = tool(
  async ({ error, language }) => {
    const params = new URLSearchParams({
      q: `[${language}] ${error}`,
      site: "stackoverflow",
      filter: "withbody",
    });

    return fetch(
      `https://api.stackexchange.com/2.3/search/advanced?${params}`
    ).then((res) => res.json());
  },
  {
    name: "stackoverflowSearch",
    description: "Find programming solutions from Stack Overflow",
    schema: z.object({
      error: z.string().describe("Error message or problem description"),
      language: z.string().describe("Programming language context"),
    }),
  }
);
