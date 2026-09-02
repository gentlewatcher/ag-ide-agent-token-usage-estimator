/**
 * Agent Usage Service - aggregates usage analytics across conversations
 */

import { discoverConversationTranscripts, parseTranscript } from './transcript-parser.js'
import type { AgentOverallStats, AgentSessionUsage, AgentUsageFilterOptions, ModelUsageStats } from './types.js'

/**
 * Parse time window filter string into cutoff Date
 */
function parseSinceCutoff(since?: string): Date | null {
  if (!since) return null

  const now = new Date()
  const lower = since.toLowerCase().trim()

  if (lower === 'today' || lower === '1d' || lower === '24h') {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }
  if (lower === '7d' || lower === 'week' || lower === '1w') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }
  if (lower === '30d' || lower === 'month' || lower === '1m') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  const parsed = new Date(since)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Get all agent sessions matching filter options
 */
export function getAgentSessions(options: AgentUsageFilterOptions = {}): AgentSessionUsage[] {
  const discovered = discoverConversationTranscripts()
  const cutoff = parseSinceCutoff(options.since)
  const sessions: AgentSessionUsage[] = []

  for (const item of discovered) {
    if (options.conversationId && !item.conversationId.toLowerCase().includes(options.conversationId.toLowerCase())) {
      continue
    }

    if (cutoff && item.mtime < cutoff) {
      continue
    }

    const session = parseTranscript(item.conversationId, item.transcriptPath)
    if (session) {
      sessions.push(session)
    }

    if (options.limit && sessions.length >= options.limit) {
      break
    }
  }

  return sessions
}

/**
 * Get aggregated agent statistics
 */
export function getAgentOverallStats(options: AgentUsageFilterOptions = {}): AgentOverallStats {
  const sessions = getAgentSessions(options)

  let totalSteps = 0
  let totalPromptTokens = 0
  let totalCompletionTokens = 0
  let totalTokens = 0
  const modelUsage: Record<string, ModelUsageStats> = {}
  const toolUsage: Record<string, number> = {}

  for (const s of sessions) {
    totalSteps += s.stepCount
    totalPromptTokens += s.totalPromptTokens
    totalCompletionTokens += s.totalCompletionTokens
    totalTokens += s.totalTokens

    // Aggregate models
    for (const [modelId, stats] of Object.entries(s.modelBreakdown)) {
      if (!modelUsage[modelId]) {
        modelUsage[modelId] = {
          modelId,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          turns: 0
        }
      }
      modelUsage[modelId].promptTokens += stats.promptTokens
      modelUsage[modelId].completionTokens += stats.completionTokens
      modelUsage[modelId].totalTokens += stats.totalTokens
      modelUsage[modelId].turns += stats.turns
    }

    // Aggregate tools
    for (const [toolName, count] of Object.entries(s.toolCallsBreakdown)) {
      toolUsage[toolName] = (toolUsage[toolName] || 0) + count
    }
  }

  return {
    totalSessions: sessions.length,
    totalSteps,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    modelUsage,
    toolUsage,
    recentSessions: sessions.slice(0, options.limit || 10)
  }
}
