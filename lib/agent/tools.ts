import { tool } from "@langchain/core/tools"
import { create, all } from "mathjs"
import { z } from "zod"
import { fetchWithRetry } from "@/lib/utils"
import { cascadingWebSearch } from "./search"

const math = create(all)

// Disable dangerous mathjs functions callable from within expressions
math.import(
  {
    import: () => {
      throw new Error("Disabled")
    },
    createUnit: () => {
      throw new Error("Disabled")
    },
    evaluate: () => {
      throw new Error("Disabled")
    },
  },
  { override: true }
)

export const calculator = tool(
  async ({
    expression,
    mode = "evaluate",
    variable = "x",
  }: {
    expression: string
    mode?: "evaluate" | "derivative" | "simplify"
    variable?: string
  }) => {
    try {
      if (!expression || expression.length > 500) {
        return "Error: Expression is empty or too long (max 500 chars)."
      }
      if (/[;{}[\]\\]/.test(expression)) {
        return "Error: Expression contains invalid characters."
      }

      if (mode === "derivative") {
        const result = math.derivative(expression, variable)
        return `d/d${variable}(${expression}) = ${result.toString()}`
      }

      if (mode === "simplify") {
        const result = math.simplify(expression)
        return `simplify(${expression}) = ${result.toString()}`
      }

      // Default: evaluate
      const node = math.parse(expression)
      const compiled = node.compile()
      const result = compiled.evaluate({})

      if (typeof result === "number") {
        if (!isFinite(result)) {
          return `Error: Result is not a finite number (got ${result}).`
        }
        return `${expression} = ${result}`
      }

      // Handle mathjs objects (matrices, fractions, etc.)
      return `${expression} = ${math.format(result, { precision: 14 })}`
    } catch (error) {
      return `Calculation error: ${error instanceof Error ? error.message : "Invalid expression"}`
    }
  },
  {
    name: "calculator",
    description: `Math tool for evaluation, derivatives, and simplification.

Modes:
- "evaluate" (default): Compute numeric result. E.g. "2+3*4", "sqrt(144)", "sin(pi/2)", "log(100, 10)", "2^10"
- "derivative": Symbolic differentiation. E.g. expression="x^2 + 3*x", variable="x" → "2*x + 3"
- "simplify": Simplify expression. E.g. "2*x + x" → "3*x"

Supports: arithmetic, trig, logs, powers, constants (pi, e), matrices, fractions, factorial, combinations, permutations.`,
    schema: z.object({
      expression: z
        .string()
        .describe(
          'The math expression. E.g. "2+3*4", "sin(pi/2)", "x^2 + 3*x"'
        ),
      mode: z
        .enum(["evaluate", "derivative", "simplify"])
        .optional()
        .describe(
          'Operation mode: "evaluate" (default), "derivative", or "simplify"'
        ),
      variable: z
        .string()
        .optional()
        .describe('Variable for derivative mode (default: "x"). E.g. "x", "t"'),
    }),
  }
)

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
  }
)

export const wikipedia = tool(
  async ({ query }: { query: string }) => {
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`
      const searchRes = await fetchWithRetry(searchUrl)
      const searchData = await searchRes.json()

      if (!searchData.query?.search?.length) {
        return "No Wikipedia articles found for this query."
      }

      const pageId = searchData.query.search[0].pageid
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&pageids=${pageId}&format=json`
      const contentRes = await fetchWithRetry(contentUrl)
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
  }
)

export const getWeather = tool(
  async ({ location }: { location: string }) => {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
      const geoRes = await fetchWithRetry(geoUrl)
      const geoData = await geoRes.json()

      if (!geoData.results?.length) {
        return `Could not find location: "${location}". Try a more specific city name.`
      }

      const { latitude, longitude, name, country } = geoData.results[0]

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&temperature_unit=celsius`
      const weatherRes = await fetchWithRetry(weatherUrl)
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
          'City or location name (e.g., "London", "New York", "Tokyo")'
        ),
    }),
  }
)

export const readWebpage = tool(
  async ({ url }: { url: string }) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetchWithRetry(url, {
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
        .describe('The full URL to read (e.g., "https://example.com/article")'),
    }),
  }
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
          'IANA timezone (e.g., "America/New_York", "Asia/Tokyo"). Defaults to server timezone if omitted.'
        ),
    }),
  }
)

export const translate = tool(
  async ({
    text,
    from = "auto",
    to,
  }: {
    text: string
    from?: string
    to: string
  }) => {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
      const res = await fetchWithRetry(url)
      const data = await res.json()

      if (!data.responseData?.translatedText || data.responseStatus === 403) {
        return `Translation failed: ${data.responseDetails || "Unknown error"}`
      }

      const translated = data.responseData.translatedText
      const detectedLang = data.responseData.match?.source || from

      return `**Translation** (${detectedLang} → ${to})\n\n${translated}`
    } catch (error) {
      return `Translation error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "translate",
    description:
      "Translate text between languages using MyMemory API. Supports 200+ languages.",
    schema: z.object({
      text: z.string().describe("The text to translate"),
      from: z
        .string()
        .optional()
        .describe(
          'Source language code (e.g., "en", "es", "fr", "de", "ja"). Defaults to auto-detect.'
        ),
      to: z
        .string()
        .describe(
          'Target language code (e.g., "en", "es", "fr", "de", "ja", "hi", "zh")'
        ),
    }),
  }
)

export const dictionary = tool(
  async ({ word }: { word: string }) => {
    try {
      const res = await fetchWithRetry(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      )

      if (!res.ok) {
        return `No definition found for "${word}".`
      }

      const data = await res.json()
      const entry = data[0]

      let output = `**${entry.word}**`
      if (entry.phonetic) output += `  ${entry.phonetic}`
      output += "\n"

      for (const meaning of entry.meanings.slice(0, 3)) {
        output += `\n_${meaning.partOfSpeech}_\n`
        for (const def of meaning.definitions.slice(0, 2)) {
          output += `- ${def.definition}\n`
          if (def.example) output += `  Example: "${def.example}"\n`
        }
        if (meaning.synonyms?.length) {
          output += `  Synonyms: ${meaning.synonyms.slice(0, 5).join(", ")}\n`
        }
        if (meaning.antonyms?.length) {
          output += `  Antonyms: ${meaning.antonyms.slice(0, 5).join(", ")}\n`
        }
      }

      if (entry.sourceUrls?.[0]) {
        output += `\nSource: ${entry.sourceUrls[0]}`
      }

      return output
    } catch (error) {
      return `Dictionary error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "dictionary",
    description:
      "Look up English word definitions, pronunciation, synonyms, antonyms, and examples.",
    schema: z.object({
      word: z.string().describe("The English word to look up"),
    }),
  }
)

export const convertCurrency = tool(
  async ({
    amount,
    from,
    to,
  }: {
    amount: number
    from: string
    to: string
  }) => {
    try {
      const res = await fetchWithRetry(
        `https://api.frankfurter.dev/v1/latest?amount=${amount}&from=${from.toUpperCase()}&to=${to.toUpperCase()}`
      )

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        return `Currency conversion failed: ${errData?.message || `HTTP ${res.status}`}`
      }

      const data = await res.json()
      const converted = data.rates[to.toUpperCase()]

      if (converted === undefined) {
        return `Could not convert ${from.toUpperCase()} to ${to.toUpperCase()}. Check currency codes.`
      }

      return `**${amount} ${data.base}** = **${converted} ${to.toUpperCase()}**\nRate: 1 ${data.base} = ${(converted / amount).toFixed(6)} ${to.toUpperCase()}\nDate: ${data.date} (ECB reference rate)`
    } catch (error) {
      return `Currency error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "convert_currency",
    description:
      "Convert between currencies using real-time ECB exchange rates. Use ISO 4217 codes (USD, EUR, GBP, INR, JPY, etc.).",
    schema: z.object({
      amount: z.number().describe("The amount to convert"),
      from: z
        .string()
        .describe('Source currency code (e.g., "USD", "EUR", "GBP", "INR")'),
      to: z
        .string()
        .describe('Target currency code (e.g., "USD", "EUR", "GBP", "INR")'),
    }),
  }
)

export const convertUnits = tool(
  async ({ value, from, to }: { value: number; from: string; to: string }) => {
    try {
      const result = math.evaluate(`${value} ${from} to ${to}`)
      return `**${value} ${from}** = **${math.format(result, { precision: 6 })}**`
    } catch (error) {
      return `Unit conversion error: ${error instanceof Error ? error.message : "Unknown or incompatible units"}`
    }
  },
  {
    name: "convert_units",
    description: `Convert between physical units. Supports length (m, km, mi, ft, in, cm, mm, yd), weight (kg, g, lb, oz, ton), temperature (degC, degF, K), volume (L, mL, gallon, cup, fl oz), time (s, min, hour, day, week, year), speed (m/s, km/h, mph), area (m^2, km^2, acre, hectare), data (byte, KB, MB, GB, TB), energy (J, kJ, cal, kcal, Wh, kWh), and more.`,
    schema: z.object({
      value: z.number().describe("The numeric value to convert"),
      from: z.string().describe('Source unit (e.g., "km", "lb", "degC", "GB")'),
      to: z.string().describe('Target unit (e.g., "mi", "kg", "degF", "MB")'),
    }),
  }
)

export const countryInfo = tool(
  async ({ country }: { country: string }) => {
    try {
      const res = await fetchWithRetry(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=name,capital,population,region,subregion,languages,currencies,timezones,flags,area,borders,continents`
      )

      if (!res.ok) {
        return `Could not find country: "${country}".`
      }

      const data = await res.json()
      const c = data[0]

      const languages = c.languages
        ? Object.values(c.languages).join(", ")
        : "N/A"
      const currencies = c.currencies
        ? Object.values(
            c.currencies as Record<string, { name: string; symbol: string }>
          )
            .map((cur) => `${cur.name} (${cur.symbol})`)
            .join(", ")
        : "N/A"
      const pop =
        c.population >= 1_000_000
          ? `${(c.population / 1_000_000).toFixed(1)}M`
          : c.population.toLocaleString()
      const area = c.area ? `${c.area.toLocaleString()} km²` : "N/A"

      return `**${c.name.common}** (${c.name.official})
Region: ${c.region}${c.subregion ? ` — ${c.subregion}` : ""}
Capital: ${c.capital?.join(", ") || "N/A"}
Population: ${pop}
Area: ${area}
Languages: ${languages}
Currencies: ${currencies}
Timezones: ${c.timezones?.join(", ") || "N/A"}
Flag: ${c.flags?.png || "N/A"}`
    } catch (error) {
      return `Country lookup error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "country_info",
    description:
      "Get information about a country: capital, population, area, languages, currencies, timezones, and flag.",
    schema: z.object({
      country: z
        .string()
        .describe('Country name (e.g., "Japan", "Brazil", "Germany")'),
    }),
  }
)

export const randomNumber = tool(
  async ({
    min = 1,
    max = 100,
    count = 1,
    type = "integer",
  }: {
    min?: number
    max?: number
    count?: number
    type?: "integer" | "decimal" | "coin" | "dice"
  }) => {
    if (type === "coin") {
      const flips = Array.from({ length: count }, () =>
        Math.random() < 0.5 ? "Heads" : "Tails"
      )
      return `**Coin flip${count > 1 ? "s" : ""}:** ${flips.join(", ")}`
    }

    if (type === "dice") {
      const rolls = Array.from(
        { length: count },
        () => Math.floor(Math.random() * (max - 1)) + 1
      )
      const total = rolls.reduce((a, b) => a + b, 0)
      return `**Dice roll${count > 1 ? "s" : ""} (d${max}):** ${rolls.join(", ")}${count > 1 ? ` (total: ${total})` : ""}`
    }

    const numbers = Array.from({ length: count }, () => {
      if (type === "decimal") {
        return +(Math.random() * (max - min) + min).toFixed(4)
      }
      return Math.floor(Math.random() * (max - min + 1)) + min
    })

    return `**Random ${type}${count > 1 ? "s" : ""} (${min}–${max}):** ${numbers.join(", ")}`
  },
  {
    name: "random_number",
    description: `Generate random numbers, flip coins, or roll dice.
Types: "integer" (default), "decimal", "coin", "dice".
For dice: max = number of sides (default 6). For coin: count = number of flips.`,
    schema: z.object({
      min: z.number().optional().describe("Minimum value (default 1)"),
      max: z
        .number()
        .optional()
        .describe("Maximum value (default 100). For dice: number of sides."),
      count: z.number().optional().describe("How many to generate (default 1)"),
      type: z
        .enum(["integer", "decimal", "coin", "dice"])
        .optional()
        .describe('Type of random generation (default "integer")'),
    }),
  }
)

export const textStats = tool(
  async ({ text }: { text: string }) => {
    const chars = text.length
    const charsNoSpaces = text.replace(/\s/g, "").length
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length
    const sentences = text
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0).length
    const paragraphs = text
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0).length
    const readingTimeMin = Math.ceil(words / 238)
    const speakingTimeMin = Math.ceil(words / 150)

    return `**Text Statistics**
Characters: ${chars.toLocaleString()} (${charsNoSpaces.toLocaleString()} without spaces)
Words: ${words.toLocaleString()}
Sentences: ${sentences.toLocaleString()}
Paragraphs: ${paragraphs.toLocaleString()}
Reading time: ~${readingTimeMin} min
Speaking time: ~${speakingTimeMin} min`
  },
  {
    name: "text_stats",
    description:
      "Analyze text and return word count, character count, sentence count, paragraph count, reading time, and speaking time.",
    schema: z.object({
      text: z.string().describe("The text to analyze"),
    }),
  }
)

export const encodeDecode = tool(
  async ({
    text,
    operation,
  }: {
    text: string
    operation:
      | "base64_encode"
      | "base64_decode"
      | "url_encode"
      | "url_decode"
      | "md5"
      | "sha256"
  }) => {
    try {
      const { createHash } = await import("node:crypto")

      switch (operation) {
        case "base64_encode":
          return `**Base64 Encode:**\n${Buffer.from(text).toString("base64")}`
        case "base64_decode":
          return `**Base64 Decode:**\n${Buffer.from(text, "base64").toString("utf-8")}`
        case "url_encode":
          return `**URL Encode:**\n${encodeURIComponent(text)}`
        case "url_decode":
          return `**URL Decode:**\n${decodeURIComponent(text)}`
        case "md5":
          return `**MD5 Hash:**\n${createHash("md5").update(text).digest("hex")}`
        case "sha256":
          return `**SHA-256 Hash:**\n${createHash("sha256").update(text).digest("hex")}`
        default:
          return "Error: Unknown operation."
      }
    } catch (error) {
      return `Encode/decode error: ${error instanceof Error ? error.message : "Invalid input"}`
    }
  },
  {
    name: "encode_decode",
    description:
      "Encode, decode, or hash text. Operations: base64_encode, base64_decode, url_encode, url_decode, md5, sha256.",
    schema: z.object({
      text: z.string().describe("The text to process"),
      operation: z
        .enum([
          "base64_encode",
          "base64_decode",
          "url_encode",
          "url_decode",
          "md5",
          "sha256",
        ])
        .describe("The operation to perform"),
    }),
  }
)

export const ipLookup = tool(
  async ({ ip }: { ip?: string }) => {
    try {
      const url = ip
        ? `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
        : `http://ip-api.com/json/?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,query`

      const res = await fetchWithRetry(url)
      const data = await res.json()

      if (data.status === "fail") {
        return `IP lookup failed: ${data.message}`
      }

      return `**IP Info: ${data.query}**
Location: ${data.city}, ${data.regionName}, ${data.country}
Coordinates: ${data.lat}, ${data.lon}
Timezone: ${data.timezone}
ZIP: ${data.zip || "N/A"}
ISP: ${data.isp}
Organization: ${data.org || "N/A"}
AS: ${data.as || "N/A"}`
    } catch (error) {
      return `IP lookup error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "ip_lookup",
    description:
      "Look up geolocation and network info for an IP address. Omit IP to look up the server's own public IP.",
    schema: z.object({
      ip: z
        .string()
        .optional()
        .describe(
          'IP address to look up (e.g., "8.8.8.8"). Omit to get server\'s own IP info.'
        ),
    }),
  }
)

export const youtubeSearch = tool(
  async ({ query, maxResults = 5 }: { query: string; maxResults?: number }) => {
    try {
      const key = process.env.YOUTUBE_API_KEY
      if (!key)
        return "YouTube search unavailable: YOUTUBE_API_KEY not configured."

      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${key}`
      const res = await fetchWithRetry(url)

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        return `YouTube search failed: ${err?.error?.message || `HTTP ${res.status}`}`
      }

      const data = await res.json()
      if (!data.items?.length) return `No YouTube videos found for "${query}".`

      const results = data.items
        .map(
          (
            item: {
              id: { videoId: string }
              snippet: {
                title: string
                channelTitle: string
                publishedAt: string
                description: string
              }
            },
            i: number
          ) => {
            const s = item.snippet
            const date = new Date(s.publishedAt).toLocaleDateString()
            return `${i + 1}. **${s.title}**\n   Channel: ${s.channelTitle} | ${date}\n   https://youtube.com/watch?v=${item.id.videoId}`
          }
        )
        .join("\n\n")

      return `**YouTube results for "${query}":**\n\n${results}`
    } catch (error) {
      return `YouTube search error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "youtube_search",
    description:
      "Search YouTube for videos. Returns titles, channels, dates, and links.",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z
        .number()
        .optional()
        .describe("Number of results (default 5, max 10)"),
    }),
  }
)

export const newsSearch = tool(
  async ({
    query,
    language = "en",
    maxResults = 5,
  }: {
    query: string
    language?: string
    maxResults?: number
  }) => {
    try {
      const key = process.env.GNEWS_API_KEY
      if (!key) return "News search unavailable: GNEWS_API_KEY not configured."

      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=${language}&max=${maxResults}&apikey=${key}`
      const res = await fetchWithRetry(url)

      if (!res.ok) {
        return `News search failed: HTTP ${res.status}`
      }

      const data = await res.json()
      if (!data.articles?.length) return `No news found for "${query}".`

      const articles = data.articles
        .map(
          (
            a: {
              title: string
              description: string
              source: { name: string }
              publishedAt: string
              url: string
            },
            i: number
          ) => {
            const date = new Date(a.publishedAt).toLocaleDateString()
            return `${i + 1}. **${a.title}**\n   ${a.source.name} | ${date}\n   ${a.description || ""}\n   ${a.url}`
          }
        )
        .join("\n\n")

      return `**News for "${query}":**\n\n${articles}`
    } catch (error) {
      return `News search error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "news_search",
    description:
      "Search for recent news articles on any topic. Returns headlines, sources, dates, and links.",
    schema: z.object({
      query: z.string().describe("The news topic to search for"),
      language: z
        .string()
        .optional()
        .describe('Language code (default "en"). E.g., "es", "fr", "de"'),
      maxResults: z
        .number()
        .optional()
        .describe("Number of results (default 5, max 10)"),
    }),
  }
)

export const movieSearch = tool(
  async ({
    query,
    type = "movie",
  }: {
    query: string
    type?: "movie" | "tv"
  }) => {
    try {
      const key = process.env.TMDB_API_KEY
      if (!key) return "Movie search unavailable: TMDB_API_KEY not configured."

      const searchUrl = `https://api.themoviedb.org/3/search/${type}?api_key=${key}&query=${encodeURIComponent(query)}`
      const searchRes = await fetchWithRetry(searchUrl)
      const searchData = await searchRes.json()

      if (!searchData.results?.length)
        return `No ${type} results found for "${query}".`

      const item = searchData.results[0]
      const title = item.title || item.name
      const date = item.release_date || item.first_air_date || "N/A"

      // Fetch details for runtime, genres, etc.
      const detailUrl = `https://api.themoviedb.org/3/${type}/${item.id}?api_key=${key}`
      const detailRes = await fetchWithRetry(detailUrl)
      const detail = await detailRes.json()

      const genres =
        detail.genres?.map((g: { name: string }) => g.name).join(", ") || "N/A"
      const runtime =
        type === "movie"
          ? detail.runtime
            ? `${detail.runtime} min`
            : "N/A"
          : detail.number_of_seasons
            ? `${detail.number_of_seasons} seasons, ${detail.number_of_episodes} episodes`
            : "N/A"

      let output = `**${title}** (${date.split("-")[0] || "N/A"})\n`
      output += `Rating: ${item.vote_average?.toFixed(1) || "N/A"}/10 (${item.vote_count?.toLocaleString() || 0} votes)\n`
      output += `Genres: ${genres}\n`
      output += `Runtime: ${runtime}\n`
      if (detail.tagline) output += `Tagline: "${detail.tagline}"\n`
      output += `\n${item.overview || "No overview available."}`
      if (item.poster_path) {
        output += `\n\nPoster: https://image.tmdb.org/t/p/w500${item.poster_path}`
      }

      return output
    } catch (error) {
      return `Movie search error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "movie_search",
    description:
      "Search for movies or TV shows. Returns title, rating, genres, runtime, overview, and poster.",
    schema: z.object({
      query: z
        .string()
        .describe('Movie or TV show name (e.g., "Inception", "Breaking Bad")'),
      type: z
        .enum(["movie", "tv"])
        .optional()
        .describe('Search type: "movie" (default) or "tv"'),
    }),
  }
)

export const cryptoPrice = tool(
  async ({ coin, currency = "usd" }: { coin: string; currency?: string }) => {
    try {
      const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coin.toLowerCase())}?localization=false&tickers=false&community_data=false&developer_data=false`
      const res = await fetchWithRetry(url)

      if (!res.ok) {
        // Try search if direct ID fails
        const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(coin)}`
        const searchRes = await fetchWithRetry(searchUrl)
        const searchData = await searchRes.json()
        const match = searchData.coins?.[0]
        if (!match) return `Cryptocurrency "${coin}" not found.`

        const retryRes = await fetchWithRetry(
          `https://api.coingecko.com/api/v3/coins/${match.id}?localization=false&tickers=false&community_data=false&developer_data=false`
        )
        if (!retryRes.ok) return `Could not fetch data for "${coin}".`
        const data = await retryRes.json()
        return formatCryptoResponse(data, currency)
      }

      const data = await res.json()
      return formatCryptoResponse(data, currency)
    } catch (error) {
      return `Crypto error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "crypto_price",
    description:
      "Get real-time cryptocurrency price, market cap, 24h change, and stats. No API key required.",
    schema: z.object({
      coin: z
        .string()
        .describe(
          'Coin ID or name (e.g., "bitcoin", "ethereum", "solana", "dogecoin")'
        ),
      currency: z
        .string()
        .optional()
        .describe(
          'Display currency (default "usd"). E.g., "eur", "gbp", "inr"'
        ),
    }),
  }
)

function formatCryptoResponse(
  data: Record<string, unknown>,
  currency: string
): string {
  const market = data.market_data as Record<string, Record<string, number>>
  const cur = currency.toLowerCase()
  const price = market.current_price?.[cur]
  const change24h = market.price_change_percentage_24h as unknown as number
  const marketCap = market.market_cap?.[cur]
  const high24 = market.high_24h?.[cur]
  const low24 = market.low_24h?.[cur]
  const ath = market.ath?.[cur]

  const fmt = (n: number | undefined) =>
    n !== undefined
      ? n.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : "N/A"
  const fmtLarge = (n: number | undefined) => {
    if (n === undefined) return "N/A"
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    return n.toLocaleString()
  }

  const symbol = (data.symbol as string)?.toUpperCase() || ""
  const arrow = change24h >= 0 ? "▲" : "▼"

  return `**${data.name} (${symbol})** — ${cur.toUpperCase()} ${fmt(price)}
24h Change: ${arrow} ${change24h?.toFixed(2) || "N/A"}%
24h High/Low: ${fmt(high24)} / ${fmt(low24)}
Market Cap: ${fmtLarge(marketCap)}
All-Time High: ${fmt(ath)}
Market Cap Rank: #${data.market_cap_rank || "N/A"}`
}

export const stockPrice = tool(
  async ({ symbol }: { symbol: string }) => {
    try {
      const key = process.env.TWELVEDATA_API_KEY
      if (!key)
        return "Stock price unavailable: TWELVEDATA_API_KEY not configured."

      const quoteUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}&apikey=${key}`
      const res = await fetchWithRetry(quoteUrl)
      const data = await res.json()

      if (data.code || data.status === "error") {
        return `Stock lookup failed: ${data.message || "Symbol not found"}`
      }

      const change = parseFloat(data.change)
      const pctChange = parseFloat(data.percent_change)
      const arrow = change >= 0 ? "▲" : "▼"

      return `**${data.name}** (${data.symbol}) — ${data.exchange}
Price: $${parseFloat(data.close).toFixed(2)}
Change: ${arrow} $${Math.abs(change).toFixed(2)} (${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(2)}%)
Open: $${parseFloat(data.open).toFixed(2)}
High: $${parseFloat(data.high).toFixed(2)}
Low: $${parseFloat(data.low).toFixed(2)}
Previous Close: $${parseFloat(data.previous_close).toFixed(2)}
Volume: ${parseInt(data.volume).toLocaleString()}
As of: ${data.datetime}`
    } catch (error) {
      return `Stock error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "stock_price",
    description:
      "Get real-time stock price, change, volume, and market data for any ticker symbol.",
    schema: z.object({
      symbol: z
        .string()
        .describe(
          'Stock ticker symbol (e.g., "AAPL", "GOOGL", "TSLA", "MSFT")'
        ),
    }),
  }
)

export const githubSearch = tool(
  async ({
    query,
    type = "repositories",
    limit = 5,
  }: {
    query: string
    type?: "repositories" | "users"
    limit?: number
  }) => {
    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
      }
      const token = process.env.GITHUB_TOKEN
      if (token) headers.Authorization = `Bearer ${token}`

      const url = `https://api.github.com/search/${type}?q=${encodeURIComponent(query)}&per_page=${limit}`
      const res = await fetchWithRetry(url, { headers })

      if (!res.ok) return `GitHub search failed: HTTP ${res.status}`

      const data = await res.json()
      if (!data.items?.length) return `No GitHub ${type} found for "${query}".`

      if (type === "repositories") {
        const repos = data.items
          .map(
            (
              r: {
                full_name: string
                description: string
                stargazers_count: number
                language: string
                html_url: string
                updated_at: string
              },
              i: number
            ) => {
              const stars =
                r.stargazers_count >= 1000
                  ? `${(r.stargazers_count / 1000).toFixed(1)}k`
                  : r.stargazers_count
              return `${i + 1}. **${r.full_name}** ⭐ ${stars}\n   ${r.description || "No description"}\n   Language: ${r.language || "N/A"} | Updated: ${new Date(r.updated_at).toLocaleDateString()}\n   ${r.html_url}`
            }
          )
          .join("\n\n")
        return `**GitHub repos for "${query}":**\n\n${repos}`
      }

      const users = data.items
        .map(
          (u: { login: string; html_url: string; type: string }, i: number) =>
            `${i + 1}. **${u.login}** (${u.type})\n   ${u.html_url}`
        )
        .join("\n\n")
      return `**GitHub users for "${query}":**\n\n${users}`
    } catch (error) {
      return `GitHub search error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "github_search",
    description:
      "Search GitHub for repositories or users. Returns names, stars, descriptions, and links.",
    schema: z.object({
      query: z
        .string()
        .describe(
          'Search query (e.g., "react state management", "machine learning python")'
        ),
      type: z
        .enum(["repositories", "users"])
        .optional()
        .describe('Search type: "repositories" (default) or "users"'),
      limit: z.number().optional().describe("Number of results (default 5)"),
    }),
  }
)

export const bookSearch = tool(
  async ({ query, maxResults = 5 }: { query: string; maxResults?: number }) => {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
      const res = await fetchWithRetry(url)

      if (!res.ok) return `Book search failed: HTTP ${res.status}`

      const data = await res.json()
      if (!data.items?.length) return `No books found for "${query}".`

      const books = data.items
        .map(
          (
            item: {
              volumeInfo: {
                title: string
                authors?: string[]
                publishedDate?: string
                averageRating?: number
                description?: string
                infoLink?: string
                pageCount?: number
              }
            },
            i: number
          ) => {
            const v = item.volumeInfo
            let entry = `${i + 1}. **${v.title}**`
            if (v.authors?.length) entry += `\n   By: ${v.authors.join(", ")}`
            if (v.publishedDate) entry += ` | ${v.publishedDate.split("-")[0]}`
            if (v.pageCount) entry += ` | ${v.pageCount} pages`
            if (v.averageRating) entry += ` | Rating: ${v.averageRating}/5`
            if (v.description) {
              entry += `\n   ${v.description.substring(0, 150)}${v.description.length > 150 ? "..." : ""}`
            }
            if (v.infoLink) entry += `\n   ${v.infoLink}`
            return entry
          }
        )
        .join("\n\n")

      return `**Books for "${query}":**\n\n${books}`
    } catch (error) {
      return `Book search error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "book_search",
    description:
      "Search for books using Google Books. Returns titles, authors, ratings, descriptions, and links.",
    schema: z.object({
      query: z
        .string()
        .describe(
          'Book title, author, or topic (e.g., "atomic habits", "author:tolkien")'
        ),
      maxResults: z
        .number()
        .optional()
        .describe("Number of results (default 5)"),
    }),
  }
)

export const placeSearch = tool(
  async ({ query, limit = 5 }: { query: string; limit?: number }) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=${limit}`
      const res = await fetchWithRetry(url, {
        headers: { "User-Agent": "WorkerAI/1.0" },
      })

      if (!res.ok) return `Place search failed: HTTP ${res.status}`

      const data = await res.json()
      if (!data.length) return `No places found for "${query}".`

      const places = data
        .map(
          (
            p: {
              display_name: string
              lat: string
              lon: string
              type: string
              address?: Record<string, string>
            },
            i: number
          ) => {
            let entry = `${i + 1}. **${p.display_name}**`
            entry += `\n   Type: ${p.type}`
            entry += `\n   Coordinates: ${parseFloat(p.lat).toFixed(5)}, ${parseFloat(p.lon).toFixed(5)}`
            entry += `\n   Map: https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=15/${p.lat}/${p.lon}`
            return entry
          }
        )
        .join("\n\n")

      return `**Places for "${query}":**\n\n${places}`
    } catch (error) {
      return `Place search error: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  },
  {
    name: "place_search",
    description:
      "Search for places, addresses, or landmarks worldwide. Returns location names, coordinates, and map links.",
    schema: z.object({
      query: z
        .string()
        .describe(
          'Place, address, or landmark (e.g., "Eiffel Tower", "coffee shops in Tokyo", "1600 Pennsylvania Ave")'
        ),
      limit: z.number().optional().describe("Number of results (default 5)"),
    }),
  }
)

export const allTools = [
  webSearch,
  wikipedia,
  getWeather,
  calculator,
  readWebpage,
  getDatetime,
  translate,
  dictionary,
  convertCurrency,
  convertUnits,
  countryInfo,
  randomNumber,
  textStats,
  encodeDecode,
  ipLookup,
  youtubeSearch,
  newsSearch,
  movieSearch,
  cryptoPrice,
  stockPrice,
  githubSearch,
  bookSearch,
  placeSearch,
]
