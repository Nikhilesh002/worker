export interface LangSmithTraceContext {
  chatId?: string
  userId?: string
  messagePreview?: string
  routeDomain?: string
  routeComplexity?: string
  routeNeedsTools?: boolean
  routeNeedsRetrieval?: boolean
  selectedTier?: string
  toolNames?: string[]
}

function normalizePreview(value?: string) {
  if (!value) return undefined
  return value.length > 120 ? `${value.slice(0, 120)}…` : value
}

export function buildLangSmithConfig(
  context: LangSmithTraceContext = {},
  runName = "worker-ai",
) {
  const tags = ["worker-ai"]

  if (context.routeDomain) tags.push(`domain:${context.routeDomain}`)
  if (context.routeComplexity) tags.push(`complexity:${context.routeComplexity}`)
  if (context.selectedTier) tags.push(`tier:${context.selectedTier}`)
  if (context.toolNames?.length) {
    for (const toolName of context.toolNames) {
      tags.push(`tool:${toolName}`)
    }
  }

  return {
    runName,
    tags,
    metadata: {
      chatId: context.chatId,
      userId: context.userId,
      messagePreview: normalizePreview(context.messagePreview),
      routeDomain: context.routeDomain,
      routeComplexity: context.routeComplexity,
      routeNeedsTools: context.routeNeedsTools,
      routeNeedsRetrieval: context.routeNeedsRetrieval,
      selectedTier: context.selectedTier,
      toolNames: context.toolNames,
    },
  }
}