import { tool } from "@langchain/core/tools"
import { create, all } from "mathjs"
import { z } from "zod"
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
  }
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
      const res = await fetch(url)
      const data = await res.json()

      if (
        !data.responseData?.translatedText ||
        data.responseStatus === 403
      ) {
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
          'Source language code (e.g., "en", "es", "fr", "de", "ja"). Defaults to auto-detect.',
        ),
      to: z
        .string()
        .describe(
          'Target language code (e.g., "en", "es", "fr", "de", "ja", "hi", "zh")',
        ),
    }),
  },
)

export const dictionary = tool(
  async ({ word }: { word: string }) => {
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
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
  },
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
      const res = await fetch(
        `https://api.frankfurter.dev/v1/latest?amount=${amount}&from=${from.toUpperCase()}&to=${to.toUpperCase()}`,
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
  },
)

export const convertUnits = tool(
  async ({
    value,
    from,
    to,
  }: {
    value: number
    from: string
    to: string
  }) => {
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
      from: z
        .string()
        .describe('Source unit (e.g., "km", "lb", "degC", "GB")'),
      to: z
        .string()
        .describe('Target unit (e.g., "mi", "kg", "degF", "MB")'),
    }),
  },
)

export const countryInfo = tool(
  async ({ country }: { country: string }) => {
    try {
      const res = await fetch(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=name,capital,population,region,subregion,languages,currencies,timezones,flags,area,borders,continents`,
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
        ? Object.values(c.currencies as Record<string, { name: string; symbol: string }>)
            .map((cur) => `${cur.name} (${cur.symbol})`)
            .join(", ")
        : "N/A"
      const pop =
        c.population >= 1_000_000
          ? `${(c.population / 1_000_000).toFixed(1)}M`
          : c.population.toLocaleString()
      const area = c.area
        ? `${c.area.toLocaleString()} km²`
        : "N/A"

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
        .describe(
          'Country name (e.g., "Japan", "Brazil", "Germany")',
        ),
    }),
  },
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
        Math.random() < 0.5 ? "Heads" : "Tails",
      )
      return `**Coin flip${count > 1 ? "s" : ""}:** ${flips.join(", ")}`
    }

    if (type === "dice") {
      const rolls = Array.from(
        { length: count },
        () => Math.floor(Math.random() * (max - 1)) + 1,
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
      count: z
        .number()
        .optional()
        .describe("How many to generate (default 1)"),
      type: z
        .enum(["integer", "decimal", "coin", "dice"])
        .optional()
        .describe('Type of random generation (default "integer")'),
    }),
  },
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
  },
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
  },
)

export const ipLookup = tool(
  async ({ ip }: { ip?: string }) => {
    try {
      const url = ip
        ? `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
        : `http://ip-api.com/json/?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,query`

      const res = await fetch(url)
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
          "IP address to look up (e.g., \"8.8.8.8\"). Omit to get server's own IP info.",
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
  translate,
  dictionary,
  convertCurrency,
  convertUnits,
  countryInfo,
  randomNumber,
  textStats,
  encodeDecode,
  ipLookup,
]
