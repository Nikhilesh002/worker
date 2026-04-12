// Cascading web search: Brave > Tavily > Serper > Google Custom Search
// Configure API keys in .env — only providers with keys are tried

import { fetchWithRetry } from "../utils"

type SearchResult = {
  title: string
  snippet: string
  url?: string
}

async function tavilySearch(query: string): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) throw new Error("No API key")

  const res = await fetchWithRetry("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()

  return (data.results || []).map((r: Record<string, string>) => ({
    title: r.title,
    snippet: r.content,
    url: r.url,
  }))
}

async function serperSearch(query: string): Promise<SearchResult[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) throw new Error("No API key")

  const res = await fetchWithRetry("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query }),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()

  return (data.organic || []).slice(0, 5).map((r: Record<string, string>) => ({
    title: r.title,
    snippet: r.snippet,
    url: r.link,
  }))
}

// Priority: Brave (2000/mo) > Tavily (1000/mo) > Serper (2500 one-time) > Google (100/day)
const searchProviders = [
  { name: "Tavily", fn: tavilySearch },
  { name: "Serper", fn: serperSearch },
  // { name: "Google", fn: googleSearch },
  // { name: "Brave", fn: braveSearch },
]

export async function cascadingWebSearch(query: string): Promise<string> {
  const errors: string[] = []

  for (const provider of searchProviders) {
    try {
      const results = await provider.fn(query)
      if (results.length > 0) {
        const formatted = results
          .map((r, i) => {
            let entry = `${i + 1}. `
            if (r.title) entry += `**${r.title}**\n   `
            entry += r.snippet
            if (r.url) entry += `\n   Source: ${r.url}`
            return entry
          })
          .join("\n\n")
        return `Search results via ${provider.name}:\n\n${formatted}`
      }
    } catch (e) {
      errors.push(
        `${provider.name}: ${e instanceof Error ? e.message : "failed"}`
      )
    }
  }

  return `No results found for "${query}". ${errors.length > 0 ? `Errors: ${errors.join("; ")}.` : ""} Try the read_webpage tool with a specific URL.`
}

// async function braveSearch(query: string): Promise<SearchResult[]> {
//   const key = process.env.BRAVE_API_KEY
//   if (!key) throw new Error("No API key")

//   const res = await fetchWithRetry(
//     `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
//     {
//       headers: {
//         Accept: "application/json",
//         "Accept-Encoding": "gzip",
//         "X-Subscription-Token": key,
//       },
//     }
//   )

//   if (!res.ok) throw new Error(`HTTP ${res.status}`)
//   const data = await res.json()

//   return (data.web?.results || [])
//     .slice(0, 5)
//     .map((r: Record<string, string>) => ({
//       title: r.title,
//       snippet: r.description,
//       url: r.url,
//     }))
// }

// async function googleSearch(query: string): Promise<SearchResult[]> {
//   const key = process.env.GOOGLE_SEARCH_API_KEY
//   const cx = process.env.GOOGLE_SEARCH_CX
//   if (!key || !cx) throw new Error("No API key")

//   const res = await fetchWithRetry(
//     `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=5`
//   )

//   if (!res.ok) throw new Error(`HTTP ${res.status}`)
//   const data = await res.json()

//   return (data.items || []).slice(0, 5).map((r: Record<string, string>) => ({
//     title: r.title,
//     snippet: r.snippet,
//     url: r.link,
//   }))
// }
