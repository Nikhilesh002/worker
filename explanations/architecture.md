# Worker AI Architecture

This document explains the full agent architecture used in this app and the LangChain / LangGraph concepts behind it.

## 1. What this system does

The app is a chat assistant with:

- Clerk authentication
- PostgreSQL persistence via Prisma
- SSE streaming from the server to the browser
- LangChain models for generation
- LangGraph for agent orchestration
- Dynamic model routing
- Dynamic tool exposure
- Summarization for long conversations

The main design goal is to keep the agent fast, scalable, and cost-aware while avoiding context overload.

---

## 2. High-level architecture

```text
┌───────────────────────┐
│   User in browser     │
└───────────┬───────────┘
	     │
	     v
┌───────────────────────┐      ┌────────────────────────────┐
│     ChatInterface     │─────>│  POST /api/stream          │
└───────────┬───────────┘      └────────────┬───────────────┘
	     │                                │
	     │ GET /api/chats + messages      │
	     v                                v
     ┌───────────────┐              ┌───────────────────────┐
     │ Prisma / DB   │<─────────────│  Clerk auth()         │
     └───────────────┘              └──────────┬────────────┘
						                       │ userId
						                      v
					  ┌───────────────────────┐
					  │ Load or create chat   │
					  └──────────┬────────────┘
						         │
					    	     v
					  ┌───────────────────────┐
					  │ Load history + summary│
					  └──────────┬────────────┘
					    	     │
					    	     v
					  ┌───────────────────────┐
					  │ LangGraph streamAgent │
					  └──────────┬────────────┘
				     		     │
			 ┌────────────────────────┼────────────────────────┐
			 │                        │                        │
			 v                        v                        v
	      ┌────────────────┐      ┌──────────────────┐      ┌──────────────────┐
	      │   Router LLM   │─────>│ Route decision   │─────>│ Dynamic middleware│
	      └────────────────┘      └──────────────────┘      └──────────┬───────┘
										     │
									┌───────────┼───────────┐
									│           │           │
									v           v           v
								┌──────────┐ ┌──────────┐ ┌──────────┐
								│Qwen3-32B │ │GPT-OSS-20B│ │GPT-OSS-120B│
								└────┬─────┘ └────┬─────┘ └────┬─────┘
								     │            │            │
								     └──────┬─────┴─────┬──────┘
									        v           v
								      ┌─────────────────────┐
								      │   ToolNode          │
								      └──────────┬──────────┘
										         │
										         v
								      ┌─────────────────────┐
								      │ SSE events to UI    │
								      └──────────┬──────────┘
                                                 │
                                                 v
								      ┌─────────────────────┐
								      │ Store assistant msg │
								      └──────────┬──────────┘
										         │
										         v
								      ┌─────────────────────┐
								      │ Async summarization  │
								      └──────────┬──────────┘
										         │
										         v
									        ┌───────┐
									        │  DB   │
									        └───────┘
```

---

## 3. End-to-end request flow

```text
1) User sends a message from the browser
   User  ->  ChatInterface

2) The UI posts the message to the stream route
   ChatInterface  ->  /api/stream

3) The server authenticates the request
   /api/stream  ->  Clerk auth()
   Clerk auth()  ->  userId

4) The server loads or creates the chat
   /api/stream  ->  Prisma DB

5) The server loads history and summary
   Prisma DB  ->  history + summary

6) LangGraph runs the agent loop
   /api/stream  ->  streamAgent(messages, summary)

7) Router classifies the request
   streamAgent  ->  Router LLM
   Router LLM   ->  structured route JSON

8) Middleware picks model + tools
   route JSON   ->  dynamic middleware
   middleware   ->  Qwen / GPT-OSS-20B / GPT-OSS-120B
   middleware   ->  filtered tools

9) ToolNode runs requested tools
   selected model  ->  ToolNode
   ToolNode        ->  tool output

10) Stream tokens and tool events back to the browser
    LangGraph  ->  SSE events  ->  ChatInterface

11) Save the final assistant response
    LangGraph  ->  Prisma DB

12) Summarize older context asynchronously
    LangGraph  ->  summary update  ->  Prisma DB
```

---

## 4. Main LangChain concepts used

### 4.1 Models

LangChain models are the reasoning engines.

In this app, models are created from Groq using `ChatGroq`.

We use three model tiers:

- Qwen3-32B: primary/default model
- GPT-OSS-20B: medium reasoning, coding, tool-heavy tasks
- GPT-OSS-120B: complex reasoning, architecture, hard debugging

Why separate factories?

- keeps model setup centralized
- allows different temperatures and behaviors
- makes routing and fallback simpler
- avoids creating a single global model instance

---

### 4.2 Messages

LangChain uses message objects to represent conversation state.

Used message types:

- `SystemMessage`: instructions and system prompt
- `HumanMessage`: user input
- `AIMessage`: assistant output

Why this matters:

- messages preserve conversational context
- LangGraph can stream, store, and reprocess them
- the router sees recent messages to classify intent

---

### 4.3 Tools

Tools are functions the model can call.

Examples in this app:

- calculator
- web search
- Wikipedia lookup
- weather
- translation
- currency conversion
- unit conversion
- location lookup
- media search

The model does not execute tools by itself. It requests tool calls, and LangGraph / ToolNode executes them.

---

### 4.4 Tool binding

`bindTools()` tells a model which tools it may use.

This is important because:

- the model can emit tool calls
- LangChain validates the tool-call format
- the agent can loop between model and tools

In this app, tools are not always fully exposed. They are filtered dynamically before binding.

---

### 4.5 Structured output

The router model uses `withStructuredOutput()` and a Zod schema.

Purpose:

- force deterministic JSON-shaped classification
- avoid free-form router output
- make routing machine-readable

Router output fields:

- complexity
- needsTools
- needsRetrieval
- domain

This router is not meant to answer the user. It only classifies the request.

---

### 4.6 Middleware

Middleware is the central extensibility point.

In LangChain v1, middleware can intercept model calls with `wrapModelCall`.

This app uses middleware to:

- classify the request
- choose a model tier
- filter tools
- handle fallback escalation
- cool down failing API keys

This is the heart of the dynamic architecture.

---

### 4.7 LangGraph

LangGraph is the orchestration layer.

It is used here to build the agent loop:

1. Call the model
2. If the model requested tools, run tools
3. Feed tool outputs back to the model
4. Repeat until the assistant gives a final answer

LangGraph is ideal because it supports:

- stateful execution
- tool loops
- streaming
- retries and fallback patterns
- future memory extensions

---

### 4.8 StateGraph

`StateGraph` defines the agent as nodes and edges.

In this app:

- `agent` node: calls the model
- `tools` node: executes tools
- edge from `START` to `agent`
- conditional edge from `agent` to `tools` if tool calls exist
- edge from `tools` back to `agent`

This is the classic model-tool loop.

---

### 4.9 Annotation / state schema

The graph state is extended with:

- messages
- summary

The summary is used as long-term compressed context.

This keeps the graph from carrying every old message forever.

---

### 4.10 Streaming

The backend streams events through SSE.

LangGraph emits events like:

- token events
- tool start events
- tool end events

The browser receives them in real time and updates the chat UI progressively.

---

## 5. Dynamic routing architecture

The routing pipeline is:

```text
Recent messages
	  │
	  v
┌──────────────────┐
│    Router LLM    │
└────────┬─────────┘
	     │
	     v
┌──────────────────────────────┐
│ Structured JSON route output │-----------|
└────────┬─────────────┬───────┘           |
	     │                                 │
	     v                                 v
   ┌────────────┐                    ┌─────────────────┐
   │ Choose tier│                    │ Choose tool sets│
   └────┬───────┘                    └────────┬────────┘
	    │                                     │
   ┌────┼─────┐                               │
   v    v     v                               v
┌──────┐ ┌─────────┐ ┌──────────────┐  ┌────────────────┐
│Qwen3 │ │GPT-OSS  │ │GPT-OSS-120B  │  │ Filtered tools │
│-32B  │ │-20B     │ │              │  └────────────────┘
└──────┘ └─────────┘ └──────────────┘
```

### Why the router is separate

The router should be cheap and deterministic.

It should:

- classify
- not answer
- not call tools
- not do long reasoning chains

That keeps routing fast and reliable.

---

## 6. Dynamic tool exposure

Not every tool should be visible on every request.

Why this matters:

- less context overload
- better tool selection
- lower chance of wrong tool calls
- lower latency

### Tool groups

```text
						 ┌─────────────────┐
						 │ Route decision   │
						 └───────┬─────────┘
								 │
	┌────────────────────────────┼────────────────────────────┐
	v                            v                            v
┌───────────────┐        ┌────────────────┐           ┌────────────────┐
│ search tools  │        │ utility tools  │           │ coding tools   │
└──────┬────────┘        └───────┬────────┘           └───────┬────────┘
	   │                         │                             │
	   v                         v                             v
 web_search, wikipedia,   calculator, get_datetime,      calculator, web_search,
 read_webpage, news_search, random_number, text_stats,    read_webpage, github_search,
 github_search, book_search, encode_decode, translate,    text_stats, encode_decode,
 movie_search               dictionary, convert_currency,  dictionary
							convert_units, country_info,
							ip_lookup

	┌──────────────────────┬──────────────────────┐
	v                      v                      v
┌───────────────┐   ┌───────────────┐      ┌────────────────┐
│ location tools│   │ media tools   │      │ filtered list  │
└──────┬────────┘   └──────┬────────┘      └────────────────┘
	   │                   │
	   v                   v
 get_weather, place_search, youtube_search, news_search,
 country_info, ip_lookup, movie_search, book_search,
 convert_units            crypto_price, stock_price
```

### How filtering works

1. Router classifies the request.
2. Middleware decides which groups are needed.
3. Only tools from those groups are passed to the model.
4. The model sees a smaller, relevant toolset.

This is much better than exposing 20+ tools every time.

---

## 7. API key manager

The Groq API key manager is a singleton.

Responsibilities:

- round-robin selection across keys
- cooldown tracking for failed keys
- reuse across the server process

Why singleton?

- one shared key pool per runtime
- no duplication
- predictable behavior across requests

This is especially useful when retries and fallback escalation are enabled.

---

## 8. Conversation persistence and summarization

The app stores messages in PostgreSQL.

Why?

- conversations survive reloads
- the sidebar can list chats
- the chat page can hydrate historical messages

Long chats are summarized to avoid unbounded context growth.

### Summary loop

```text
Historical messages
	│
	v
┌──────────────────────┐
│   SummarizeMessages  │
└──────────┬───────────┘
	   │
	   v
┌──────────────────────┐
│ Compressed summary   │
└──────────┬───────────┘
	   │
	   v
┌──────────────────────┐
│    Chat.summary      │
└──────────┬───────────┘
	   │
	   v
┌──────────────────────┐
│  Future agent runs   │
└──────────────────────┘
```

The summary acts like compressed long-term memory.

---

## 9. SSE streaming architecture

```text
┌───────────────────┐
│    Agent graph    │
└─────────┬─────────┘
			 │
			 v
┌───────────────────┐
│    Emit events    │
└──────┬────┬────┬───┘
		 │    │    │
		 v    v    v
	 token  tool  done
			 start/end
		 │    │    │
		 └────┼────┘
				v
┌───────────────────┐
│ Server-Sent Events│
└─────────┬─────────┘
			 │
			 v
┌───────────────────┐
│ Browser updates   │
└───────────────────┘
```

The UI handles streaming incrementally:

- tokens appear as they arrive
- tool calls are displayed live
- errors are rendered as assistant messages with retry

---

## 10. Error handling and fallback

The system handles errors at multiple levels:

- router fallback to a safe route
- API key cooldown on rate limit or permission errors
- model escalation from primary to medium to expert
- UI retry button on failed assistant messages

This gives the app resilience without requiring manual intervention.

---

## 11. Why this architecture is strong

This design is good because it is:

- semantic instead of keyword-based
- dynamic instead of static
- modular instead of monolithic
- cost-aware instead of wasteful
- scalable instead of brittle

The key principle is:

> The router classifies. The middleware decides. The graph executes.

---

## 12. Mental model

Think about the system as 4 layers:

```text
┌─────────────────────┐
│ 1. Router LLM       │
│    - classify       │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ 2. Middleware       │
│    - route model    │
│    - route tools    │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ 3. LangGraph        │
│    - execute loop   │
│    - tools + stream │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ 4. UI + Persistence │
│    - render         │
│    - store          │
└─────────────────────┘
```

### Layer 1: Router LLM

Decides intent, complexity, and tool needs.

### Layer 2: Middleware

Chooses model tier and tools.

### Layer 3: LangGraph

Runs the model-tool loop and streams output.

### Layer 4: UI + Persistence

Renders messages, saves chats, and shows retries.

---

## 13. Summary

The app is built around a modern LangChain v1 style architecture:

- models are created by factories
- routing is done by a cheap semantic router model
- middleware dynamically selects model and tools
- LangGraph orchestrates the agent loop
- SSE streams tokens and tool events to the browser
- Prisma persists chats and summaries
- Clerk protects the endpoints

This is a good production pattern for multi-tool assistants.
