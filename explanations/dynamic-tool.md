# Plan: Dynamic Per-Iteration Tool Selection

## Context

All previous robustness fixes (loop exit bug, token waste, deduplication, prompt discipline) are already implemented. The remaining issue is that `model.bindTools(tools)` is called **once before the loop** in `graph.ts:39`, so every model call in the agent loop (tool-calling iteration AND synthesis iteration) sees the same set of route-filtered tools.

In LangSmith this shows up as 14+ tools attached to every call — including the synthesis call where the model is just reading ToolMessage results and composing a response. The synthesis call doesn't need any tools; showing tools there wastes schema tokens and risks the model making unnecessary additional tool calls instead of synthesizing.

The user's request: dynamic tool selection per model call, following the LangChain `wrapModelCall` pattern from official docs.

---

## Root Cause

**File**: [lib/agent/graph.ts](lib/agent/graph.ts) — line 39

```ts
const boundModel = model.bindTools(tools as any)   // ← bound once, reused for all iterations
```

The agent has two distinct phases per turn:
- **Tool phase** (iteration 0, and occasionally later): `workingMessages` ends with a human or system message → model should see tools to pick from
- **Synthesis phase** (final iteration after tool calls): `workingMessages` ends with `ToolMessage`(s) → model should synthesize and answer — no tools needed

Currently both phases receive identical `boundModel`, so LangSmith traces all show the full tool list regardless of phase.

---

## Fix: Per-Iteration `bindTools` with Phase Detection

**File**: [lib/agent/graph.ts](lib/agent/graph.ts)

Move `bindTools` inside the loop. Before each iteration, detect the phase by checking whether `workingMessages` contains any `ToolMessage` (import is already present at line 5). If it does, bind an empty tool array — the model cannot call more tools and must synthesize. Otherwise bind the route-filtered tools as normal.

**Exact change** — remove line 39, add three lines inside the loop before `retry`:

Before:
```ts
const boundModel = model.bindTools(tools as any)
// ... (lines 41–64) ...
    const stream = await retry(
      () => boundModel.stream(workingMessages, traceConfig as any),
```

After (line 39 removed, three lines added inside loop):
```ts
// (line 39 removed — no pre-loop bindTools)
// ... (lines 41–64) ...
    const isSynthesisPhase = workingMessages.some((m) => m instanceof ToolMessage)
    const iterationTools = isSynthesisPhase ? [] : tools
    const boundModel = model.bindTools(iterationTools as any)
    const stream = await retry(
      () => boundModel.stream(workingMessages, traceConfig as any),
```

`ToolMessage` is already imported from `@langchain/core/messages` at line 5 — no new imports needed.

---

## Why Not Use `dynamicModelMiddleware` / `wrapModelCall` directly

`dynamicModelMiddleware` in [lib/ai/dynamicModelMiddleware.ts](lib/ai/dynamicModelMiddleware.ts) is defined but wraps a single model call, not an iterative loop. Using it would require restructuring the entire streaming loop around a callback — a large refactor with no additional benefit over the per-iteration `bindTools` approach above, which is equally correct and far simpler.

---

## Files to Modify

| File | Change |
|------|--------|
| `lib/agent/graph.ts` | Remove pre-loop `bindTools` (line 39), add per-iteration phase detection + `bindTools` inside loop |

---

## Verification

1. **LangSmith trace**: After change, send a search query (e.g. "latest AI news"). Trace should show:
   - Call 1: tool list present (web_search, wikipedia, etc.) → model calls `web_search`
   - Call 2 (synthesis): tool list **empty** → model returns text response
2. **Correctness**: Response still arrives with actual content — synthesis still works.
3. **No regression**: Math queries (`what is sqrt(144)?`) still route to calculator; no tools in synthesis call.
