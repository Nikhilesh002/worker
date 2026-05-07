import type { RouteDecision } from "./dynamicModelMiddleware"

export type ToolGroup = "search" | "utility" | "coding" | "location" | "media"

const TOOL_GROUPS: Record<ToolGroup, Set<string>> = {
  search: new Set([
    "web_search",
    "wikipedia",
    "read_webpage",
    "github_search",
  ]),
  utility: new Set([
    "calculator",
    "get_datetime",
    "random_number",
    "text_stats",
    "encode_decode",
    "convert_units",
    "translate",
    "dictionary",
    "convert_currency",
    "country_info",
    "ip_lookup",
  ]),
  coding: new Set([
    "calculator",
    "web_search",
    "read_webpage",
    "github_search",
    "text_stats",
    "encode_decode",
  ]),
  location: new Set(["convert_units"]),
  media: new Set([]),
}

function getDefaultGroups(route: RouteDecision): ToolGroup[] {
  if (!route.needsTools && route.domain !== "location") {
    return []
  }

  const groups: ToolGroup[] = ["utility"]

  if (route.needsRetrieval && route.domain !== "location") {
    groups.push("search")
  }

  switch (route.domain) {
    case "coding":
    case "debugging":
    case "architecture":
    case "data": {
      groups.push("coding")
      break
    }
    case "research": {
      groups.push("search")
      break
    }
    case "math": {
      groups.push("utility")
      break
    }
    case "location": {
      groups.push("location")
      break
    }
    case "creative": {
      groups.push("media")
      break
    }
    default: {
      break
    }
  }

  if (route.complexity === "complex") {
    groups.push("coding")
  }

  return [...new Set(groups)]
}

export function selectToolGroups(route: RouteDecision): ToolGroup[] {
  return getDefaultGroups(route)
}

export function filterToolsByRoute<T extends { name: string }>(
  route: RouteDecision,
  tools: T[],
): T[] {
  const groups = selectToolGroups(route)
  if (groups.length === 0) return []

  const allowed = new Set<string>()
  for (const group of groups) {
    for (const toolName of TOOL_GROUPS[group]) {
      allowed.add(toolName)
    }
  }

  return tools.filter((tool) => allowed.has(tool.name))
}
