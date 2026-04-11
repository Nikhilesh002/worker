import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { cascadingWebSearch } from "./search"

export const webSearch = tool(
  async ({ query }: { query: string }) => {
    return cascadingWebSearch(query)
  },
  {
    name: "web_search",
    description:
      "Search the web for current information, news, or facts. Uses multiple search providers with automatic fallback.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  },
)

export const wikipedia = tool(
  async ({ query }: { query: string }) => {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`
      const searchRes = await fetch(searchUrl)
      const searchData = await searchRes.json()

      if (!searchData.query?.search?.length) {
        return "No Wikipedia articles found for this query."
      }

      const pageId = searchData.query.search[0].pageid
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&pageids=${pageId}&format=json`
      const contentRes = await fetch(contentUrl)
      const contentData = await contentRes.json()

      const page = contentData.query.pages[pageId]
      const extract =
        page.extract?.substring(0, 2000) || "No content available."

      return `**${page.title}**\n\n${extract}\n\nSource: https://en.wikipedia.org/?curid=${pageId}`
    } catch (error) {
      return `Wikipedia lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "wikipedia",
    description:
      "Search Wikipedia for detailed, encyclopedic information about a topic.",
    schema: z.object({
      query: z.string().describe("The topic to search for on Wikipedia"),
    }),
  },
)

export const getWeather = tool(
  async ({ location }: { location: string }) => {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
      const geoRes = await fetch(geoUrl)
      const geoData = await geoRes.json()

      if (!geoData.results?.length) {
        return `Could not find location: "${location}". Try a more specific city name.`
      }

      const { latitude, longitude, name, country } = geoData.results[0]

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&temperature_unit=celsius`
      const weatherRes = await fetch(weatherUrl)
      const weatherData = await weatherRes.json()

      const current = weatherData.current
      const weatherCodes: Record<number, string> = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
      }

      return `**Weather in ${name}, ${country}**
Temperature: ${current.temperature_2m}\u00B0C
Feels like: ${current.apparent_temperature}\u00B0C
Humidity: ${current.relative_humidity_2m}%
Wind Speed: ${current.wind_speed_10m} km/h
Condition: ${weatherCodes[current.weather_code] || "Unknown"}`
    } catch (error) {
      return `Weather lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "get_weather",
    description: "Get the current weather for a city or location.",
    schema: z.object({
      location: z
        .string()
        .describe(
          'City or location name (e.g., "London", "New York", "Tokyo")',
        ),
    }),
  },
)

export const calculator = tool(
  async ({ expression }: { expression: string }) => {
    try {
      const cleaned = expression.replace(
        /\b(sin|cos|tan|asin|acos|atan|sqrt|log|log2|log10|abs|ceil|floor|round|pow|exp)\b/g,
        "",
      )
      const safe = /^[0-9+\-*/().%\s^,]+$/.test(cleaned)
      if (!safe) {
        return "Error: Expression contains invalid characters. Only numbers, operators, parentheses, and math functions are allowed."
      }

      const sanitized = expression
        .replace(
          /\b(sin|cos|tan|asin|acos|atan|sqrt|log|log2|log10|abs|ceil|floor|round|exp)\b/g,
          "Math.$1",
        )
        .replace(/\bpow\b/g, "Math.pow")
        .replace(/\bPI\b/g, "Math.PI")
        .replace(/\bE\b/g, "Math.E")
        .replace(/\^/g, "**")

      const result = new Function(`"use strict"; return (${sanitized})`)()

      if (typeof result !== "number" || !isFinite(result)) {
        return `Error: Result is not a valid number (got ${result})`
      }

      return `${expression} = ${result}`
    } catch (error) {
      return `Calculation error: ${error instanceof Error ? error.message : "Invalid expression"}`
    }
  },
  {
    name: "calculator",
    description:
      "Evaluate mathematical expressions. Supports: +, -, *, /, ^ (power), %, parentheses, and functions like sin, cos, sqrt, log, abs, ceil, floor, round, pow, PI, E.",
    schema: z.object({
      expression: z
        .string()
        .describe(
          'Math expression (e.g., "2 + 3 * 4", "sqrt(144)", "2^10", "sin(PI/2)")',
        ),
    }),
  },
)

export const readWebpage = tool(
  async ({ url }: { url: string }) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        return `Failed to fetch URL: HTTP ${res.status} ${res.statusText}`
      }

      const contentType = res.headers.get("content-type") || ""
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain")
      ) {
        return `URL returned non-text content (${contentType}). Cannot extract text.`
      }

      const html = await res.text()

      let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<aside[\s\S]*?<\/aside>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")

      text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

      text = text.replace(/<[^>]+>/g, " ")
      text = text.replace(/\s+/g, " ").trim()

      if (text.length > 5000) {
        text = text.substring(0, 5000) + "... [truncated]"
      }

      return text || "Could not extract meaningful text content from this URL."
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "Request timed out after 10 seconds."
      }
      return `Failed to read webpage: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "read_webpage",
    description:
      "Fetch and extract text content from a URL. Good for reading articles, docs, blog posts.",
    schema: z.object({
      url: z
        .string()
        .describe(
          'The full URL to read (e.g., "https://example.com/article")',
        ),
    }),
  },
)

export const getDatetime = tool(
  async ({ timezone }: { timezone?: string }) => {
    try {
      const now = new Date()
      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "long",
        ...(timezone ? { timeZone: timezone } : {}),
      }

      const formatted = now.toLocaleString("en-US", options)
      const unix = Math.floor(now.getTime() / 1000)

      return `**Current Date & Time**\n${formatted}\nUnix timestamp: ${unix}`
    } catch (error) {
      return `Could not get datetime: ${error instanceof Error ? error.message : "Invalid timezone"}`
    }
  },
  {
    name: "get_datetime",
    description:
      "Get the current date and time. Optionally specify a timezone.",
    schema: z.object({
      timezone: z
        .string()
        .optional()
        .describe(
          'IANA timezone (e.g., "America/New_York", "Asia/Tokyo"). Defaults to server timezone if omitted.',
        ),
    }),
  },
)

export const allTools = [
  webSearch,
  wikipedia,
  getWeather,
  calculator,
  readWebpage,
  getDatetime,
]
