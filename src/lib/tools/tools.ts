import { tool } from "@langchain/core/tools";
import { z } from "zod";
// import * as math from "mathjs";
import { toolNames } from "./toolNode";
import { logger } from "../../../logger";

export const listMyTools = tool(
  () => {
    // toolNames
    const toolsList = "";
    toolNames.forEach((tool: string) => {
      toolsList.concat(tool + " : " + eval(tool).description + "\n");
    });
    logger.info(toolsList);
    return toolsList;
  },
  {
    name: "listMyTools",
    description: "List of all tools you are equipped with",
  }
);

export const getSystemDateTime = tool(
  () => {
    const curDateTime = Date.now().toString();
    logger.info(curDateTime);
    return curDateTime;
  },
  {
    name: "getSystemDateTime",
    description:
      "get system date and time in --Tue Aug 19 1975 23:15:30 GMT+0530 (IST)-- example format",
  }
);

// export const currencyConverter = tool(
//   async ({ amount, from, to, date }) => {
//     from = from.toLowerCase();
//     to = to.toLowerCase();

//     const resp = await fetch(
//       `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${from}.json`
//     ).then((res) => res.json());
//     return { result: amount * resp[from][to], currency: to };
//   },
//   {
//     name: "currencyConverter",
//     description:
//       "Convert between world currencies using real-time exchange rates",
//     schema: z.object({
//       amount: z.number().describe("The amount to convert"),
//       from: z.string().describe("Base currency code (e.g., USD)"),
//       to: z.string().describe("Target currency code (e.g., EUR)"),
//       date: z
//         .string()
//         .describe(
//           "Date on which you want to convert currency in YYYY-MM-DD format"
//         ),
//     }),
//   }
// );

// export const scientificCalculator = tool(
//   async ({ expression }) => {
//     return { result: math.evaluate(expression) };
//   },
//   {
//     name: "scientificCalculator",
//     description:
//       "Advanced math operations including algebra, calculus, and statistics using mathjs npm package",
//     schema: z.object({
//       expression: z
//         .string()
//         .describe("Mathematical expression in mathjs format to evaluate"),
//     }),
//   }
// );

export const npmPackageSuggestions = tool(
  async ({ keyword }) => {
    const res = await fetch(
      `https://www.npmjs.com/search/suggestions?q=${keyword}`
    );
    const data = res.json();
    console.log(JSON.stringify(data));
    return JSON.stringify(data);
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
    const res = await fetch(`https://registry.npmjs.org/${name}`);
    const data = res.json();
    console.log(JSON.stringify(data));
    return JSON.stringify(data);
  },
  {
    name: "npmPackageLookup",
    description: "Get detailed information about an NPM packages",
    schema: z.object({
      name: z.string().describe("Package name to look up"),
    }),
  }
);

// export const translateText = tool(
//   async ({ text, target }) => {
//     const res = await fetch("https://libretranslate.com/translate", {
//       method: "POST",
//       body: JSON.stringify({
//         q: text,
//         source: "auto",
//         target: target,
//       }),
//     });
//     return res.json();
//   },
//   {
//     name: "translateText",
//     description: "Translate text between 100+ languages",
//     schema: z.object({
//       text: z.string().describe("Text to translate"),
//       target: z.string().describe("Target language code (e.g., es, fr)"),
//     }),
//   }
// );

// export const dockerImageScanner = tool(
//   async ({ image }) => {
//     return fetch(`https://hub.docker.com/v2/repositories/${image}/tags/`, {
//       headers: {
//         "X-Docker-Token": "true",
//       },
//     }).then((res) => res.json());
//   },
//   {
//     name: "dockerImageScanner",
//     description: "Get Docker image metadata and vulnerability reports",
//     schema: z.object({
//       image: z.string().describe("Image name (e.g., library/nginx)"),
//     }),
//   }
// );

// export const stackoverflowSearch = tool(
//   async ({ error, language }) => {
//     const params = new URLSearchParams({
//       q: `[${language}] ${error}`,
//       site: "stackoverflow",
//       filter: "withbody",
//     });

//     return fetch(
//       `https://api.stackexchange.com/2.3/search/advanced?${params}`
//     ).then((res) => res.json());
//   },
//   {
//     name: "stackoverflowSearch",
//     description: "Find programming solutions from Stack Overflow",
//     schema: z.object({
//       error: z.string().describe("Error message or problem description"),
//       language: z.string().describe("Programming language context"),
//     }),
//   }
// );

// export const getCustomerById = tool(
//   async ({ id }) => {
//     const resp = await fetch(
//       `https://introspection.apis.stepzen.com/customers/${id}`,
//       {
//         method: "GET",
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     ).then((res) => res.json());

//     return resp;
//   },
//   {
//     name: "getCustomerById",
//     description:
//       "Retrieve specific customer information including their address and order history. Return customer details, including name, address, and past orders with shipping details. To search for a specific customer with id: 1, use curl url followed by /1 i.e: https://api.example.com/customers/1",
//     schema: z.object({
//       id: z.string().describe("The customer id to use in your search."),
//     }),
//   }
// );

// export const vulnerabilityCheck = tool(
//   async ({ packageName, version }) => {
//     const [npmData, advisories] = await Promise.all([
//       fetch(`https://registry.npmjs.org/${packageName}`),
//       fetch(`https://api.github.com/advisories?package=${packageName}`),
//     ]);

//     return {
//       latestVersion: (await npmData.json())["dist-tags"].latest,
//       vulnerabilities: (await advisories.json()).map((adv: any) => ({
//         severity: adv.severity,
//         patched_versions: adv.vulnerable_version_range,
//       })),
//     };
//   },
//   {
//     name: "vulnerabilityCheck",
//     description: "Check for security vulnerabilities in NPM packages",
//     schema: z.object({
//       packageName: z.string().describe("NPM package name"),
//       version: z.string().optional().describe("Specific version to check"),
//     }),
//   }
// );

// export const codeReviewer = tool(
//   async ({ code, context }) => {
//     return fetch("https://api.codegpt.co/v1/reviews", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.CODEGPT_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         code: code,
//         context: context,
//         analysis: ["security", "performance", "best-practices"],
//       }),
//     }).then((res) => res.json());
//   },
//   {
//     name: "codeReviewer",
//     description: "Get AI-powered code review with improvement suggestions",
//     schema: z.object({
//       code: z.string().describe("Source code to review"),
//       context: z.string().describe("Purpose/context of the code"),
//     }),
//   }
// );

// export const getWeather = tool(
//   async ({ location }) => {
//     return fetch(
//       `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${process.env.OWM_KEY}`
//     ).then((res) => res.json());
//   },
//   {
//     name: "getWeather",
//     description: "Get current weather conditions and 5-day forecast",
//     schema: z.object({
//       location: z.string().describe("City name or ZIP code"),
//     }),
//   }
// );

// export const dictionaryLookup = tool(
//   async ({ word }) => {
//     return fetch(
//       `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${word}?key=${process.env.DICT_KEY}`
//     ).then((res) => res.json());
//   },
//   {
//     name: "dictionaryLookup",
//     description: "Get definitions, pronunciations, and word origins",
//     schema: z.object({
//       word: z.string().describe("Word to look up"),
//     }),
//   }
// );

// export const githubRepoSearch = tool(
//   async ({
//     query,
//     language,
//     sort,
//   }: any) => {
//     const params = new URLSearchParams({
//       q: query + "language:" + language,
//       sort: sort,
//     });

//     return fetch(`https://api.github.com/search/repositories?${params}`, {
//       headers: {
//         Accept: "application/vnd.github+json",
//         Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
//       },
//     }).then((res) => res.json());
//   },
//   {
//     name: "githubRepoSearch",
//     description: "Search GitHub repositories with advanced filters",
//     schema: z.object({
//       query: z.string().describe("Search terms (e.g., 'news recommendation')"),
//       language: z
//         .string()
//         .optional()
//         .describe("Filter by programming language"),
//       sort: z
//         .enum(["stars", "forks", "updated"])
//         .optional()
//         .describe("Sort criteria"),
//     }),
//   }
// );

// export const codeComplexity = tool(
//   async ({ code, language }) => {
//     const complexityMetrics = await escomplex.analyze(code, {
//       language: language,
//       skipCalculation: false,
//     });
//     return {
//       cyclomatic: complexityMetrics.aggregate.cyclomatic,
//       halstead: complexityMetrics.aggregate.halstead,
//     };
//   },
//   {
//     name: "codeComplexity",
//     description: "Analyze code complexity metrics (Cyclomatic, Halstead)",
//     schema: z.object({
//       code: z.string().describe("Source code to analyze"),
//       language: z.enum(["js", "py", "java"]).describe("Programming language"),
//     }),
//   }
// );

// export const ipGeolocation = tool(
//   async ({ ip }) => {
//     return fetch(`https://ipapi.co/${ip}/json/`).then((res) => res.json());
//   },
//   {
//     name: "ipGeolocation",
//     description:
//       "Get geographical location and ISP information for any IP address",
//     schema: z.object({
//       ip: z.string().describe("IPv4/IPv6 address to investigate"),
//     }),
//   }
// );

// export const newsSearch = tool(
//   async ({ query }) => {
//     return fetch(
//       `https://newsapi.org/v2/everything?q=${query}&apiKey=${process.env.NEWS_API_KEY}`
//     ).then((res) => res.json());
//   },
//   {
//     name: "newsSearch",
//     description: "Search global news articles from 30,000+ sources",
//     schema: z.object({
//       query: z.string().describe("Search keywords or phrases"),
//     }),
//   }
// );
