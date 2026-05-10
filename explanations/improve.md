# Plan: Make AI Chat App Robust & Efficient

## Context
The app has two major problems:
1. **Critical bug**: The agent loop exits after executing tool calls, so the model never gets a chance to synthesize results into a response. This causes `{"type":"done"}` to fire before any AI response tokens arrive — user sees "Thinking..." forever.
2. **Token waste**: Duplicate tool alias, loose system prompt, and bad router fallback cause redundant web searches and unnecessary tool chaining.

---

## Bug 1: Loop Exits Before Synthesis (Critical)

**File**: [lib/agent/graph.ts](lib/agent/graph.ts) — lines 91–147

**Root cause**: After executing `MAX_TOOL_CALLS_PER_TURN` (= 2) tools, the outer for-loop `break`s at line 145. This means:
- Iteration 0: model calls 2 tools → executed → `toolCallsUsed = 2` → **`break`** — loop exits
- Iteration 1 (synthesis) **never runs** → no response tokens → `done` event fires immediately

**Fix**:
1. Raise `MAX_TOOL_CALLS_PER_TURN` from `2` → `3` (allows search + read + one more).
2. Remove the outer `if (toolCallsUsed >= MAX_TOOL_CALLS_PER_TURN) { break }` entirely.
3. In the inner tool-call `for` loop, when skipping a tool due to limit, push a `ToolMessage` with `"Tool limit reached — please synthesize results."` so the LangChain message chain stays valid (AIMessage tool_calls must have matching ToolMessages).
4. The natural termination `if (!toolCalls.length) { break }` handles synthesis-complete correctly.

**Result**: Model always gets one final iteration to synthesize tool results into a coherent answer.

---

## Fix 2: Remove Duplicate `search` Alias

**File**: [lib/agent/tools.ts](lib/agent/tools.ts) — lines 115–127, 1280–1296

The `search` tool is an exact alias for `web_search` — same implementation, different name. It is already filtered out by `filterToolsByRoute` (not in any toolGroup), but it still bloats the `allTools` array and wastes schema tokens if ever included.

**Fix**: Remove `search` from the `allTools` export array. Keep the definition if needed elsewhere, but it does not belong in the agent's tool list.

---

## Fix 3: System Prompt — Enforce Tool Discipline

**File**: [lib/prompts/agent.ts](lib/prompts/agent.ts)

Current prompt has no guidance on tool efficiency. Model freely chains web_search → web_search → read_webpage.

**Fix**: Add a `## Tool Discipline` section:
```
- Use the MINIMUM number of tools needed. One web_search is almost always enough.
- Do NOT call web_search multiple times for the same or similar query.
- Only use read_webpage when the user explicitly asks to read a URL, or when the search snippet is clearly insufficient.
- Never call both `web_search` and `search` — they are the same.
- Answer immediately from tool results without re-searching.
```

---

## Fix 4: Router Error Fallback — Use Safe Defaults

**File**: [lib/ai/dynamicModelMiddleware.ts](lib/ai/dynamicModelMiddleware.ts) — lines 158–169

When the router model throws (rate limit, etc.), the fallback is the worst possible:
```ts
{ complexity: 'complex', needsTools: true, needsRetrieval: true, domain: 'other' }
```
This gives the model every tool and picks the expert-tier model. Instead, fail to a safe default:
```ts
{ complexity: 'medium', needsTools: true, needsRetrieval: false, domain: 'general' }
```
This uses the medium model with utility tools only (no search), which is appropriate for most queries.

---

## Fix 5: Add Pattern Bypasses for Obvious Local Queries

**File**: [lib/ai/dynamicModelMiddleware.ts](lib/ai/dynamicModelMiddleware.ts) — lines 136–147 (after the translation bypass)

Add fast-path bypasses that skip the router LLM call entirely for obviously local (no-retrieval) queries:

```ts
// Math / calculator
if (/\b(calculate|compute|solve|what is \d|math|derivative|integral|simplify)\b/i.test(text)) {
  return { complexity: 'simple', needsTools: true, needsRetrieval: false, domain: 'math' }
}
// Date / time
if (/\b(what('s| is) (the )?(date|time|day)|current (date|time)|today|right now)\b/i.test(text)) {
  return { complexity: 'simple', needsTools: true, needsRetrieval: false, domain: 'general' }
}
// Unit / currency conversion
if (/\b(convert|how many|in (km|miles|kg|pounds|usd|eur|gbp|inr))\b/i.test(text)) {
  return { complexity: 'simple', needsTools: true, needsRetrieval: false, domain: 'general' }
}
```

---

## Fix 6: Tighten `read_webpage` Description

**File**: [lib/agent/tools.ts](lib/agent/tools.ts) — lines 229–304

Change description to discourage automatic chaining after search:
> "Fetch and extract text from a URL. Only use this when the user explicitly provides a URL to read, or when search snippets are clearly insufficient and deeper detail is required."

---

## Files to Modify

| File | Change |
|------|--------|
| `lib/agent/graph.ts` | Fix loop exit bug, raise tool call limit |
| `lib/agent/tools.ts` | Remove `search` alias from allTools, tighten `read_webpage` description |
| `lib/prompts/agent.ts` | Add Tool Discipline section |
| `lib/ai/dynamicModelMiddleware.ts` | Fix router fallback, add pattern bypasses |

---

## Verification

1. **Bug fix test**: Ask "when is next CSK match?" — should see web_search tool events followed by text tokens, then `done`. No `done` before tokens.
2. **Efficiency test**: Ask "what is 25 * 48?" — should NOT call web_search; should use calculator or answer directly.
3. **Efficiency test**: Ask "what time is it?" — should call `get_datetime` once, not search.
4. **Redundancy test**: Check EventStream — should see at most 1–2 tool calls for a single-topic query, not 4.
