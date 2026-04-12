# Worker AI — Complete Project Explanation

An AI chatbot with 23 real-time tools, streaming responses, conversation summarization, and persistent chat history. Built with Next.js 16, LangGraph, Groq, Prisma, and Clerk.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Request Lifecycle — What Happens When You Send a Message](#2-request-lifecycle)
3. [File-by-File Breakdown](#3-file-by-file-breakdown)
4. [Key Concepts Explained](#4-key-concepts-explained)
5. [Interview Questions & Answers](#5-interview-questions--answers)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (React 19 + Next.js 16 App Router)        │
│                                                     │
│  Landing Page ──► Chat Layout ──► ChatInterface     │
│       (/)         (/chat)     (/chat/[chatId])      │
│                      │                              │
│                   Sidebar ◄── CustomEvents           │
│                (chat list)   (chat-created/deleted)  │
└───────────┬────────────────────────┬────────────────┘
            │ REST (JSON)            │ SSE (streaming)
            ▼                        ▼
┌───────────────────┐  ┌──────────────────────────────┐
│ GET /api/chats    │  │ POST /api/stream              │
│ GET /api/messages │  │   1. Auth (Clerk)             │
│ DELETE /api/chats │  │   2. Store user message (DB)  │
│   (normal HTTP)   │  │   3. Load history + summary   │
└───────┬───────────┘  │   4. Run LangGraph agent      │
        │              │   5. Stream tokens via SSE     │
        │              │   6. Store assistant response  │
        ▼              │   7. Trigger summarization     │
┌──────────────┐       └──────────────┬────────────────┘
│   Prisma     │                      │
│  PostgreSQL  │◄─────────────────────┘
│              │                      │
│  Chat        │       ┌──────────────▼────────────────┐
│  Message     │       │  LangGraph Agent Loop          │
└──────────────┘       │                                │
                       │  START ──► callAgent ──►check  │
                       │              ▲          │      │
                       │              │    tool_calls?  │
                       │              │     yes│  no│   │
                       │              │        ▼    ▼   │
                       │           tools     END       │
                       │          (23 tools)            │
                       └────────────────────────────────┘
                                      │
                                      ▼
                       ┌────────────────────────────────┐
                       │  External APIs                  │
                       │  Groq (LLM), Wikipedia,         │
                       │  Open-Meteo, CoinGecko,         │
                       │  TMDB, Tavily/Serper, etc.      │
                       └────────────────────────────────┘
```

**Two separate communication patterns:**
- **REST** (normal JSON) — Loading chat list, loading message history, deleting chats
- **SSE** (Server-Sent Events) — Only for streaming the LLM response in real-time

---

## 2. Request Lifecycle

Here is exactly what happens when you type "What's the weather in Tokyo?" and press Enter:

### Step 1: Frontend (`ChatInterface.tsx`)
```
handleSend() fires
  → Optimistic UI: adds user message bubble immediately
  → POST fetch to /api/stream with { chatId, message }
  → Starts reading response as a stream (SSE)
```

### Step 2: API Route (`app/api/stream/route.ts`)
```
POST handler:
  → auth() — Clerk verifies the JWT cookie, extracts userId
  → If no chatId, create a new Chat row in DB
  → Store the user's message in the Message table
  → Load the Chat (with summary field) from DB
  → Load ALL messages for this chat, ordered by time
  → Convert DB messages → LangChain message objects
  → Call streamAgent(langchainMessages, summary)
```

### Step 3: LangGraph Agent (`lib/agent/graph.ts`)
```
streamAgent() calls graph.streamEvents()
  → callAgent() runs:
      1. Builds system prompt (injects summary if exists)
      2. Keeps only last 10 messages (older = in summary)
      3. Calls Groq LLM with all 23 tools bound
      4. LLM decides: "I need the get_weather tool"
      5. Returns AIMessage with tool_calls: [{name: "get_weather", args: {location: "Tokyo"}}]

  → shouldContinue() checks: tool_calls exist? → route to "tools" node

  → ToolNode executes get_weather("Tokyo")
      → Calls Open-Meteo API (with retry)
      → Returns: "Weather in Tokyo, Japan\nTemperature: 22°C..."

  → Loops back to callAgent()
      → LLM now has the tool result
      → Generates final text response: "The current weather in Tokyo is..."
      → No more tool_calls → shouldContinue() returns END
```

### Step 4: Streaming Back (`route.ts` → `ChatInterface.tsx`)
```
Each event from the graph is sent as SSE:
  data: {"type":"tool_start","name":"get_weather","input":{"location":"Tokyo"}}
  data: {"type":"tool_end","name":"get_weather","output":"Weather in Tokyo..."}
  data: {"type":"token","content":"The"}
  data: {"type":"token","content":" current"}
  data: {"type":"token","content":" weather"}
  ...
  data: {"type":"done"}
```

### Step 5: Storage & Summarization (`route.ts`)
```
After streaming completes:
  → Store full assistant response in Message table
    (including <<<TOOL_CALL:get_weather>>>...<<<END_TOOL_CALL>>> markers)
  → Check if unsummarized messages > 10
    → If yes, fire-and-forget: call LLM to summarize older messages
    → Store summary on Chat.summary
```

---

## 3. File-by-File Breakdown

### `middleware.ts` — Auth Gate (runs on every request)

```typescript
import { clerkMiddleware } from "@clerk/nextjs/server"
export default clerkMiddleware()
```

**What it does:** Clerk's middleware intercepts every request (except static assets). It reads the JWT from cookies, verifies it, and makes `auth()` available in server components and API routes.

**The `matcher` regex:** Excludes `_next/` (Next.js internals) and static files (`.css`, `.js`, `.png`, etc). Includes all `/api/*` and `/trpc/*` routes.

**Why it matters:** Without this, `auth()` in API routes would always return `{ userId: null }`.

---

### `prisma/schema.prisma` — Database Schema

```
Chat                              Message
┌──────────────────────────┐     ┌─────────────────────────┐
│ id        (CUID, PK)     │     │ id      (CUID, PK)      │
│ title     (String)       │◄────│ chatId  (FK → Chat.id)  │
│ userId    (String, idx)  │     │ content (Text)           │
│ summary   (Text, null)   │     │ role    ("user"|"assistant")
│ summarizedUpToIndex (Int)│     │ createdAt (DateTime)     │
│ createdAt (DateTime)     │     └─────────────────────────┘
│ updatedAt (DateTime)     │
│ messages  (Message[])    │
└──────────────────────────┘
```

**`summary`** — Stores a condensed version of older conversation messages. Updated asynchronously after responses.

**`summarizedUpToIndex`** — Tracks which messages are already in the summary (e.g., if this is 12, messages 0-11 are summarized, 12+ are raw).

**`onDelete: Cascade`** — When a Chat is deleted, all its Messages are automatically deleted too.

**`@db.Text`** — Uses PostgreSQL's `TEXT` type (unlimited length) instead of `VARCHAR(255)`.

---

### `lib/prisma.ts` — Database Client (Singleton)

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

**Why the global trick?** In development, Next.js hot-reloads modules frequently. Each reload would create a new `PrismaClient`, opening new database connections until PostgreSQL runs out. By storing the client on `globalThis`, we reuse the same connection pool across hot reloads. In production, modules load once, so this is unnecessary.

---

### `lib/utils.ts` — Shared Utilities

```typescript
// 1. Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
`clsx` handles conditional classes: `cn("px-4", isActive && "bg-blue-500")`. `twMerge` deduplicates Tailwind conflicts: `cn("px-2", "px-4")` → `"px-4"` (not `"px-2 px-4"`).

```typescript
// 2. Generic retry with delay
export async function retry(fn: any, retries: number, delay = 0) {
  try {
    return await fn()
  } catch (err) {
    if (retries === 0) throw err
    if (delay) await new Promise((res) => setTimeout(res, delay))
    return retry(fn, retries - 1, delay)
  }
}
```
Recursive retry. On failure, waits `delay` ms, then tries again with `retries - 1`. When `retries === 0`, it gives up and throws. Used for both LLM calls and API fetches.

```typescript
// 3. Fetch with automatic retry
export const fetchWithRetry = (url: string, options?: RequestInit) =>
  retry(() => fetch(url, options), 2, 400 + Math.random() * 600)
```
Every external API call in the tools uses this. Retries up to 2 times with a randomized 400-1000ms delay. The randomization prevents "thundering herd" — if 100 requests fail at once, they don't all retry at the exact same millisecond.

---

### `lib/groq.ts` — LLM Model Factory

```typescript
const apiKeys = process.env.GROQ_API_KEYS?.split("|") || []

export function getModel() {
  const randomIndex = Math.floor(Math.random() * 100) % apiKeys.length
  return new ChatGroq({
    apiKey: apiKeys[randomIndex],
    model: "openai/gpt-oss-20b",
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
  })
}
```

**Why a factory function (not a singleton)?** Each call picks a random API key. Groq free tier has per-key rate limits. By rotating keys, we get N times the throughput.

**Why called inside `retry()`?** In `graph.ts`:
```typescript
retry(() => getModel().bindTools(allTools).invoke(trimmedMessages), 2, ...)
```
If key #1 is rate-limited, the retry calls `getModel()` again → picks a different random key → succeeds.

**`temperature: 0.7`** — Controls randomness. 0 = deterministic, 1 = creative. 0.7 is a good balance for a general assistant.

**`maxTokens: 4096`** — Maximum tokens the model can generate in one response (output only, not input).

---

### `lib/agent/search.ts` — Cascading Web Search

```typescript
const searchProviders = [
  { name: "Tavily", fn: tavilySearch },
  { name: "Serper", fn: serperSearch },
]

export async function cascadingWebSearch(query: string): Promise<string> {
  for (const provider of searchProviders) {
    try {
      const results = await provider.fn(query)
      if (results.length > 0) return formatResults(results, provider.name)
    } catch (e) {
      errors.push(...)
    }
  }
  return "No results found..."
}
```

**Cascading fallback pattern:** Try Tavily first. If it fails (rate limit, network error, no API key), catch the error and try Serper. If all fail, return a helpful error message. This gives resilience — the chatbot's search works as long as at least one provider is up.

Each provider normalizes its response into a common `SearchResult` shape: `{ title, snippet, url }`.

---

### `lib/agent/tools.ts` — 23 Tool Definitions

Every tool follows the same pattern:

```typescript
export const toolName = tool(
  async (params) => {        // 1. The function that runs
    try {
      // call API / compute / etc
      return "formatted result"
    } catch (error) {
      return "error message"   // Never throw — return error as string
    }
  },
  {
    name: "tool_name",          // 2. Name the LLM sees
    description: "...",         // 3. When to use this tool
    schema: z.object({          // 4. Zod schema for parameters
      param: z.string().describe("..."),
    }),
  },
)
```

**Why return errors instead of throwing?** If a tool throws, the LangGraph agent loop crashes. By returning error strings, the LLM sees "Weather lookup failed: timeout" and can tell the user or try a different approach.

**Mathjs security hardening:**
```typescript
const math = create(all)
math.import({
  import: () => { throw new Error("Disabled") },
  createUnit: () => { throw new Error("Disabled") },
  evaluate: () => { throw new Error("Disabled") },
}, { override: true })
```
This disables dangerous functions that could be called from *within* a mathjs expression. Without this, someone could craft an expression like `evaluate("process.exit()")`. After this, `math.parse()` still works (we need it), but `evaluate()` as an expression-level function is blocked.

---

### `lib/agent/systemPrompt.ts` — System Instructions

The system prompt tells the LLM:
1. **Who it is** — "Worker AI, a helpful assistant with real-time tools"
2. **Guidelines** — Use tools for real-time info, don't fabricate, use markdown
3. **Tool catalog** — Lists all 23 tools with descriptions

The LLM reads this before every message. It's how the model knows tools exist and when to use them.

At runtime, the conversation summary gets appended:
```
[original system prompt]

## Conversation Summary (older context)
The user asked about weather in Tokyo. The assistant used get_weather
and found it was 22°C and sunny. Then the user asked about...
```

---

### `lib/agent/graph.ts` — The Brain (LangGraph Agent)

This is the most important file. Let me explain every section:

#### State Definition
```typescript
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,    // messages: BaseMessage[]
  summary: Annotation<string>({  // conversation summary
    reducer: (_, b) => b,        // always use the latest value
    default: () => "",           // start empty
  }),
})
```
LangGraph uses "annotations" to define what data flows through the graph. `MessagesAnnotation` is built-in — it manages a list of messages and knows how to append new ones. We extend it with `summary`.

The `reducer: (_, b) => b` means: when updated, replace the old value entirely (not merge/append).

#### The Agent Node
```typescript
async function callAgent(state: typeof AgentState.State) {
  const { messages, summary } = state

  // 1. Build system prompt with summary
  let systemContent = SYSTEM_PROMPT
  if (summary) {
    systemContent += `\n\n## Conversation Summary (older context)\n${summary}`
  }

  // 2. Strip existing system message (API route adds one, we build our own)
  const userMessages = hasSystemMessage ? messages.slice(1) : messages

  // 3. Keep only last 10 messages — older context is in the summary
  const recentMessages = userMessages.length > 10
    ? userMessages.slice(-10)
    : userMessages

  // 4. Final messages: [SystemMessage, ...recent 10]
  const trimmedMessages = [new SystemMessage(systemContent), ...recentMessages]

  // 5. Call LLM with retry + random key rotation
  const response = await retry(
    () => getModel().bindTools(allTools).invoke(trimmedMessages),
    2, 400 + Math.random() * 600,
  )
  return { messages: [response] }
}
```

**Why `slice(-10)` instead of sending everything?** LLMs have a context window limit. Sending 100 messages wastes tokens on old, possibly irrelevant text. The summary compresses those into a paragraph.

**`bindTools(allTools)`** — Tells the LLM about all 23 tools. The LLM can then respond with `tool_calls` instead of (or in addition to) text.

#### The Router
```typescript
function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1]
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
    return "tools"    // LLM wants to call a tool → go to tools node
  }
  return END          // LLM is done → end the graph
}
```

This creates the **agent loop**:
1. LLM says "I need to call web_search" → go to tools
2. Tools execute → results added to messages → back to LLM
3. LLM says "Now I need calculator too" → go to tools again
4. Tools execute → back to LLM
5. LLM says "Here's your answer: ..." (no tool calls) → END

#### The Graph
```typescript
const workflow = new StateGraph(AgentState)
  .addNode("agent", callAgent)      // LLM reasoning
  .addNode("tools", toolNode)       // Tool execution
  .addEdge(START, "agent")          // Always start with LLM
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",                 // If tool_calls → execute tools
    [END]: END,                     // If no tool_calls → done
  })
  .addEdge("tools", "agent")        // After tools → back to LLM

export const graph = workflow.compile()
```

**Visual:**
```
START → agent → shouldContinue? ──yes──► tools ──┐
                    │                             │
                    no                            │
                    │                             │
                   END ◄──────────────────────────┘
```

#### The Stream Bridge
```typescript
export async function* streamAgent(messages, summary?) {
  const eventStream = graph.streamEvents(
    { messages, summary: summary || "" },
    { version: "v2" },
  )

  for await (const event of eventStream) {
    switch (event.event) {
      case "on_chat_model_stream":   // LLM generating text token by token
        yield { type: "token", content }
        break
      case "on_tool_start":          // Tool execution begins
        yield { type: "tool_start", name, input }
        break
      case "on_tool_end":            // Tool execution completes
        yield { type: "tool_end", name, output }
        break
    }
  }
}
```

`function*` with `async` = **async generator**. It produces values lazily — the caller gets each event as it happens, not all at once. This is what enables real-time streaming.

`graph.streamEvents()` gives us fine-grained events from inside the graph — every token as the LLM generates it, and tool start/end events.

---

### `lib/agent/summarize.ts` — Conversation Memory

```typescript
const SUMMARIZE_PROMPT = `You are a conversation summarizer. Condense the
conversation below into a concise summary that preserves:
- Key facts, names, preferences, and decisions
- Important tool results
- Overall topic and direction
- Unresolved questions or ongoing tasks
Max 400 words.`

export async function summarizeMessages({ existingSummary, messagePairs }) {
  let input = ""
  if (existingSummary) {
    input += `Previous conversation summary:\n${existingSummary}\n\n---\n\n`
  }
  // Append new messages, stripped of tool markers
  for (const msg of messagePairs) { ... }

  const response = await retry(
    () => getModel().invoke([SystemMessage(SUMMARIZE_PROMPT), HumanMessage(input)]),
    2, 400 + Math.random() * 600,
  )
  return response.content
}
```

**Incremental summarization:** It doesn't re-summarize the whole conversation. It takes the *existing* summary + *new unsummarized messages* and asks the LLM to produce an updated summary. This is O(n) in new messages, not O(total).

---

### `app/api/stream/route.ts` — The SSE Endpoint

This is the central coordination point. Line by line:

```typescript
export const maxDuration = 60  // Vercel/serverless timeout: 60 seconds
```

**Auth + Chat creation (lines 13-32):**
```typescript
const { userId } = await auth()          // Clerk reads JWT from cookies
if (!userId) return 401

const { chatId, message } = await req.json()

if (!currentChatId) {                    // First message in a new conversation
  const chat = await prisma.chat.create({
    data: { title: message.substring(0, 80), userId }
  })
  currentChatId = chat.id
}
```

**Store user message + load history (lines 34-53):**
```typescript
await prisma.message.create({            // Persist user message immediately
  data: { chatId: currentChatId, content: message, role: "user" }
})

const chat = await prisma.chat.findUnique(...)  // Get summary
const history = await prisma.message.findMany({  // Get all messages
  where: { chatId: currentChatId },
  orderBy: { createdAt: "asc" },
})
```

**Convert to LangChain format (lines 55-66):**
```typescript
const langchainMessages = [
  new SystemMessage(SYSTEM_PROMPT),
  ...history.map((msg) => {
    if (msg.role === "user") return new HumanMessage(msg.content)
    // Strip <<<TOOL_CALL:...>>> markers — LLM shouldn't see these
    const cleanContent = msg.content.replace(/<<<TOOL_CALL:[\s\S]*?<<<END_TOOL_CALL>>>\n?/g, "")
    return new AIMessage(cleanContent)
  }),
]
```

**Why strip tool markers?** The markers (`<<<TOOL_CALL:web_search>>>...<<<END_TOOL_CALL>>>`) are our storage format for tool calls embedded in assistant messages. The LLM shouldn't see this — it would be confused by the formatting.

**SSE streaming (lines 70-112):**
```typescript
const stream = new ReadableStream({
  async start(controller) {
    const send = (data) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    }
    // ... iterate streamAgent events, call send() for each
  }
})

return new Response(stream, {
  headers: { "Content-Type": "text/event-stream", ... }
})
```

**SSE format:** Each event is `data: {json}\n\n`. The double newline separates events. The frontend reads these with `reader.read()` and splits on `\n\n`.

**Tool call storage (lines 89-108):**
```typescript
case "tool_start":
  storedParts.push(`<<<TOOL_CALL:${event.name}>>>\n${JSON.stringify(event.input)}\n`)
case "tool_end":
  storedParts.push(`${event.output}\n<<<END_TOOL_CALL>>>`)
```

The stored content in DB looks like:
```
Let me check the weather.
<<<TOOL_CALL:get_weather>>>
{"location":"Tokyo"}
Weather in Tokyo, Japan\nTemperature: 22°C...
<<<END_TOOL_CALL>>>
The current weather in Tokyo is 22°C and sunny.
```

**Async summarization trigger (lines 131-141):**
```typescript
const unsummarizedCount = history.length + 1 - summarizedUpTo
if (unsummarizedCount > SUMMARIZE_THRESHOLD) {
  triggerSummarization(...)  // Fire-and-forget — doesn't block the response
}
```

`triggerSummarization` is called without `await` — it runs in the background. The user gets their response immediately; the summary is updated for *next* time.

---

### `app/layout.tsx` — Root Layout

```typescript
export const dynamic = "force-dynamic"
```
Tells Next.js: never try to statically prerender any page. Everything is server-rendered on demand. Needed because ClerkProvider requires a valid API key at render time.

```typescript
<ClerkProvider appearance={{ baseTheme: dark, variables: { colorPrimary: "#06b6d4" } }}>
  <html>
    <body>
      <ThemeProvider>{children}</ThemeProvider>
    </body>
  </html>
</ClerkProvider>
```

Clerk wraps everything for auth. ThemeProvider (next-themes) wraps for dark/light mode.

---

### `app/page.tsx` — Landing Page

Simple marketing page. Two conditional renders based on auth state:
- **Signed in** → "Open Chat" link to `/chat`
- **Signed out** → "Get Started" button that opens Clerk's sign-in modal

`SignedIn`/`SignedOut` are Clerk components that conditionally render based on auth state.

---

### `app/chat/layout.tsx` — Chat Layout (with Sidebar)

```typescript
const { isSignedIn, isLoaded } = useAuth()  // Clerk hook

useEffect(() => {
  if (isLoaded && !isSignedIn) router.push("/")  // Redirect if not signed in
}, [isLoaded, isSignedIn, router])
```

**Auth guard pattern:** `isLoaded` starts `false` (Clerk is initializing). Once loaded, if not signed in, redirect. This prevents a flash of the chat UI before redirect.

```typescript
<main className={`h-full transition-all duration-200 ${sidebarOpen ? "ml-72" : "ml-0"}`}>
```

Main content shifts right when sidebar is open. `transition-all duration-200` animates the margin change.

---

### `app/chat/[chatId]/page.tsx` — Existing Chat Page

```typescript
useEffect(() => {
  fetch(`/api/chats/${chatId}/messages`)   // Regular REST call (not SSE!)
    .then(res => res.json())
    .then(data => setMessages(data))
}, [chatId])

return <ChatInterface chatId={chatId} initialMessages={messages} />
```

Loads history via normal HTTP, then passes it to ChatInterface. SSE is only used when *sending* a new message.

---

### `components/chat/ChatInterface.tsx` — Main Chat UI

**The core state:**
```typescript
const [messages, setMessages] = useState<Message[]>(initialMessages)  // Persisted messages
const [streamedContent, setStreamedContent] = useState("")             // Currently streaming text
const [toolCalls, setToolCalls] = useState<ToolCall[]>([])             // Active tool calls
const currentChatId = useRef(chatId)                                   // Mutable ref for chat ID
```

**Why `useRef` for chatId?** When creating a new chat, the chatId changes mid-stream (server returns `chat_created` event). A `useState` would cause a re-render and potentially lose the stream. A `useRef` updates silently.

**SSE parsing in `handleSend`:**
```typescript
const reader = res.body?.getReader()    // ReadableStream reader
const decoder = new TextDecoder()
let buffer = ""

while (reader) {
  const { done, value } = await reader.read()  // Read chunk
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split("\n\n")            // SSE events split by double newline
  buffer = lines.pop() || ""                    // Keep incomplete last chunk

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue    // Skip non-data lines
    const data = JSON.parse(line.slice(6))      // Parse JSON after "data: "
    // Handle token/tool_start/tool_end/done/error events
  }
}
```

**Why `buffer += ... lines.pop()`?** Network chunks don't align with SSE events. A chunk might end in the middle of an event: `data: {"type":"tok`. We keep the incomplete part in `buffer` and prepend it to the next chunk.

**Optimistic UI:**
```typescript
setMessages(prev => [
  ...prev,
  { id: `temp-${Date.now()}`, content: userMessage, role: "user" }
])
```
The user message appears instantly (before the server even responds). This makes the UI feel fast.

**Chat URL update on creation:**
```typescript
case "chat_created":
  currentChatId.current = data.chatId
  window.history.replaceState(null, "", `/chat/${data.chatId}`)
  window.dispatchEvent(new CustomEvent("chat-created"))
```
`replaceState` changes the URL without a page reload. The custom event tells the Sidebar to refresh its chat list.

---

### `components/chat/MessageBubble.tsx` — Message Rendering

**`parseContent()`** — Splits stored content into text and tool call segments:
```
Input:  "Here's what I found\n<<<TOOL_CALL:web_search>>>...<<<END_TOOL_CALL>>>\nSummary..."
Output: [
  { type: "text", content: "Here's what I found" },
  { type: "tool_call", name: "web_search", input: "...", output: "..." },
  { type: "text", content: "Summary..." },
]
```

Uses regex with `exec()` in a while loop to find all matches and extract text between them.

**`MarkdownContent`** — Custom React Markdown with styled components for dark theme. Each HTML element gets Tailwind classes: cyan links, dark code blocks, bordered tables, etc.

---

### `components/chat/ToolCallDisplay.tsx` — Tool Call UI

Collapsible card showing what tool was called and its result:
```
[✓ 🔍 Web Search              ▶]     ← Collapsed (click to expand)
[✓ 🔍 Web Search              ▼]     ← Expanded
  Input:
  {"query": "latest AI news"}
  Output:
  1. **OpenAI announces...** ...
```

`toolMeta` maps tool names to icons/labels. The `status` field toggles between a spinner (running) and checkmark (done).

---

### `components/chat/Sidebar.tsx` — Chat List

```typescript
useEffect(() => {
  const handler = () => fetchChats()
  window.addEventListener("chat-created", handler)     // From ChatInterface
  window.addEventListener("chat-deleted", handler)
  return () => { /* cleanup listeners */ }
}, [])
```

**Cross-component communication via CustomEvents:** When ChatInterface creates a new chat, it dispatches `"chat-created"`. The Sidebar listens and refreshes its list. No need for global state management (Redux/Zustand).

**Active chat highlighting:**
```typescript
const activeChatId = pathname.split("/chat/")[1]
// ...
className={activeChatId === chat.id ? "bg-white/[0.06]" : "..."}
```

---

## 4. Key Concepts Explained

### Server-Sent Events (SSE) vs WebSockets

| | SSE | WebSocket |
|---|---|---|
| Direction | Server → Client only | Bidirectional |
| Protocol | HTTP | Separate protocol (ws://) |
| Reconnection | Built-in auto-reconnect | Manual |
| Complexity | Simple (just HTTP) | More complex |
| Use case | Streaming responses | Real-time chat, games |

This project uses SSE because data only flows server → client during streaming. The client sends messages via regular POST requests.

### LangGraph vs LangChain

**LangChain** = library of components (LLMs, tools, prompts, parsers).
**LangGraph** = framework for building stateful agent loops using a graph of nodes.

Think of LangChain as Lego bricks and LangGraph as the instruction manual that says how to connect them.

### The Agent Loop Pattern

Traditional chatbot: User → LLM → Response (one shot).
Agent chatbot: User → LLM → "I need data" → Tool → LLM → "I need more data" → Tool → LLM → Response.

The LLM *decides* what tools to call and when to stop. It's autonomous within the loop.

### Context Window Management

The problem: LLMs have a fixed context window (e.g., 8K tokens). A conversation with 50 messages easily exceeds this.

Solutions (from worst to best):
1. **Truncate** — Drop old messages (lose context)
2. **Sliding window** — Keep last N messages (still lose context)
3. **Summarization** — Compress old messages into a summary (preserve context efficiently)
4. **RAG** — Embed messages and retrieve relevant ones (overkill for chat)

This project uses **#3**: System prompt + summary + last 10 raw messages.

### Why `new Function()` Was Dangerous

The old calculator used:
```typescript
const result = new Function(`"use strict"; return (${sanitized})`)()
```
This compiles and executes JavaScript code. Even with regex sanitization, crafted inputs could escape. For example, Unicode escapes, constructor chains, or template literals could bypass regex guards.

The mathjs replacement parses expressions into an AST (Abstract Syntax Tree) — it never compiles JavaScript. It's a different language entirely.

---

## 5. Interview Questions & Answers

### Architecture & System Design

**Q: Why did you choose SSE over WebSockets for streaming?**
A: SSE is simpler and sufficient for our use case — data only flows server→client during LLM streaming. The client sends messages via regular POST requests. SSE works over standard HTTP (no upgrade needed), has built-in reconnection, and is easier to deploy behind load balancers and CDNs. WebSockets would add complexity without benefit since we don't need bidirectional real-time communication.

**Q: How do you handle long conversations without exceeding the LLM's context window?**
A: We use incremental conversation summarization. When the unsummarized message count exceeds a threshold (10), we asynchronously call the LLM to compress older messages into a summary paragraph stored in the database. On each request, the context sent to the LLM is: system prompt + summary + last 10 raw messages. This preserves full conversation context while keeping token usage bounded. The summarization is fire-and-forget — it doesn't block the user's response.

**Q: Explain the agent loop. How does the LLM decide to call tools?**
A: The LLM is given tool definitions via `bindTools()`. When it determines it needs external data, it returns a structured `tool_calls` array instead of text. Our `shouldContinue` function checks for these tool calls — if present, it routes to the ToolNode which executes them. The results are appended to the message history and the LLM is called again. This loop continues until the LLM responds with text and no tool calls, at which point `shouldContinue` returns END. The LLM can call multiple tools across multiple iterations in a single user interaction.

**Q: Why use a cascading search instead of a single search API?**
A: Resilience and cost optimization. Free tier APIs have low rate limits. If Tavily's 1000/month quota is exhausted, Serper takes over automatically. The user never sees a "search failed" error unless all providers are down. It's the same pattern load balancers use — primary/fallback with automatic failover.

**Q: How do you ensure the chatbot is secure against prompt injection via tools?**
A: Multiple layers. (1) The calculator uses mathjs's AST parser — never `eval()` or `new Function()`. Dangerous mathjs functions like `import` and `evaluate` are overridden to throw errors. (2) Input validation on all tools: length limits, character blocklists. (3) Tool outputs are treated as data, not instructions — the LLM sees tool results as `ToolMessage` content, not as system instructions. (4) Each tool returns error strings instead of throwing, preventing tool failures from crashing the agent loop.

### Backend & API

**Q: Why store tool calls as markers in the message content instead of a separate table?**
A: Simplicity and atomicity. Tool calls are always displayed alongside the message that triggered them. Storing them inline means a single DB read gets everything needed to render a message. A separate table would require joins, complicate the API, and risk orphaned tool records. The markers are stripped when loading history for the LLM context, so they don't pollute the conversation.

**Q: How does the retry mechanism work with API key rotation?**
A: The `retry()` utility is a recursive function that catches errors and retries with a delay. For LLM calls, the key insight is that `getModel()` is called *inside* the retry callback: `retry(() => getModel().bindTools(...).invoke(...))`. Each retry creates a new ChatGroq instance with a randomly selected API key. If key #1 hits a rate limit, the next attempt naturally picks a different key. The delay includes randomized jitter (400-1000ms) to avoid thundering herd problems.

**Q: Why is summarization async (fire-and-forget) instead of synchronous?**
A: User experience. Summarization requires an additional LLM call (400-1000ms+). If we waited for it, every response in long conversations would have noticeable extra latency. By running it in the background, the user gets their response immediately. The summary is ready for the *next* message. The tradeoff is that one message might have slightly stale context, but this is negligible in practice.

**Q: How does the Prisma singleton pattern prevent connection leaks?**
A: In development, Next.js hot-reloads modules on every file change. Each reload would call `new PrismaClient()`, opening a new connection pool (default 5 connections). After a few saves, PostgreSQL hits its connection limit. By storing the client on `globalThis` (which survives hot reloads), we reuse the same pool. In production, modules load once, so the pattern is unnecessary but harmless.

### Frontend

**Q: Why use `useRef` for `currentChatId` instead of `useState`?**
A: The chatId can change mid-stream when the server sends a `chat_created` event. A `useState` update triggers a re-render, which could interrupt the active stream reader. A `useRef` updates the value in place without re-rendering. The stream reading loop accesses the latest value through `currentChatId.current`.

**Q: How does cross-component communication work between ChatInterface and Sidebar?**
A: Via browser CustomEvents. When ChatInterface creates a new chat or a chat is deleted, it dispatches `window.dispatchEvent(new CustomEvent("chat-created"))`. The Sidebar listens with `window.addEventListener("chat-created", fetchChats)`. This avoids global state libraries (Redux/Zustand) for a simple use case. The tradeoff is that it only works client-side and doesn't scale to complex state, but for "refresh a list when something changes" it's perfect.

**Q: Explain the SSE parsing logic in the frontend. Why do you need a buffer?**
A: Network doesn't respect message boundaries. A single `reader.read()` call might return: `data: {"type":"token","content":"Hel` — an incomplete SSE event. Or it might return multiple events at once. The buffer accumulates raw bytes, splits on `\n\n` (SSE event delimiter), and keeps the last incomplete chunk for the next iteration. This guarantees we only parse complete JSON events.

**Q: What's the difference between `messages` state and `streamedContent` state?**
A: `messages` holds completed, persisted messages. `streamedContent` holds the text currently being generated by the LLM token-by-token. While streaming, the UI shows both: the message history from `messages` plus the in-progress response from `streamedContent`. When streaming finishes (the `done` event), the accumulated text moves from `streamedContent` into `messages` and `streamedContent` resets to empty.

### Database & Data Modeling

**Q: Why use `@db.Text` instead of default `String`?**
A: Default `String` in Prisma maps to `VARCHAR(255)` in PostgreSQL — limited to 255 characters. Assistant messages with tool call markers can easily exceed this. `@db.Text` maps to PostgreSQL's `TEXT` type, which has no practical length limit. This prevents silent truncation of long responses.

**Q: Explain the `summarizedUpToIndex` field.**
A: It tracks which messages are already covered by the summary. If `summarizedUpToIndex = 12`, messages at indices 0-11 are in the summary; messages 12+ are unsummarized. When we trigger summarization, we only pass messages from index 12 onward (plus the existing summary), not the entire history. This makes summarization incremental — O(new messages) instead of O(total messages).

**Q: Why `onDelete: Cascade` on the Message→Chat relation?**
A: When a user deletes a chat, all associated messages should also be deleted. Without cascade, we'd have orphaned Message rows with a chatId pointing to a non-existent Chat, wasting storage and causing foreign key errors. Cascade handles this atomically at the database level — no application code needed, and no risk of partial deletion.

### Tools & Security

**Q: How do you prevent malicious code execution in the calculator tool?**
A: We replaced `new Function()` (which is essentially `eval()`) with mathjs's expression parser. Mathjs parses expressions into an Abstract Syntax Tree — it never compiles or executes JavaScript. Additionally, we disable dangerous mathjs functions (`import`, `evaluate`, `createUnit`) by overriding them to throw errors. Input validation rejects expressions with `; {} [] \` characters and enforces a 500-character length limit. The evaluation runs with an empty scope `evaluate({})` — no access to variables or runtime objects.

**Q: What happens if an external API (weather, crypto, etc.) is down?**
A: Three layers of resilience. (1) `fetchWithRetry` retries failed requests up to 2 times with jitter delay. (2) Each tool catches all errors and returns an error string (never throws). The LLM sees "Weather lookup failed: timeout" and can inform the user gracefully. (3) For search specifically, the cascading pattern tries multiple providers. The chatbot degrades gracefully — individual tool failures don't crash the system.

**Q: Why do tools with API keys check for the key and return a message instead of throwing?**
A: This is the graceful degradation pattern. Tools like `youtube_search` check `process.env.YOUTUBE_API_KEY` at runtime. If missing, they return "YouTube search unavailable: YOUTUBE_API_KEY not configured." The LLM sees this and can tell the user or try an alternative (like web_search). If we threw an error instead, the agent loop would crash and the user would see a generic error message. This way, the chatbot works with whatever APIs are configured.
