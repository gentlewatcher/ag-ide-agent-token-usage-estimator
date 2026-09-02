/**
 * Parser for Antigravity Agent conversation transcripts and logs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getAntigravityBrainDirs, getAntigravityHistoryDirs } from '../core/env.js'
import { debug } from '../core/logger.js'
import type { AgentSessionUsage, AgentStepUsage, ModelUsageStats } from './types.js'

/**
 * Character to token heuristic (approx 4 chars per token for English/Code)
 */
function estimateTokens(text?: string): number {
  if (!text || typeof text !== 'string') return 0
  return Math.ceil(text.length / 4)
}

/**
 * Discover all Antigravity conversation log files across brain and history directories
 */
export function discoverConversationTranscripts(): Array<{ conversationId: string; transcriptPath: string; mtime: Date }> {
  const found: Map<string, { conversationId: string; transcriptPath: string; mtime: Date }> = new Map()

  // Search in brain directories
  const brainDirs = getAntigravityBrainDirs()
  for (const brainDir of brainDirs) {
    if (!existsSync(brainDir)) continue

    try {
      const entries = readdirSync(brainDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const conversationId = entry.name
          const logsDir = join(brainDir, conversationId, '.system_generated', 'logs')
          const transcriptPath = join(logsDir, 'transcript.jsonl')
          const transcriptFullPath = join(logsDir, 'transcript_full.jsonl')

          const targetFile = existsSync(transcriptPath)
            ? transcriptPath
            : existsSync(transcriptFullPath)
            ? transcriptFullPath
            : null

          if (targetFile) {
            const stat = statSync(targetFile)
            found.set(conversationId, {
              conversationId,
              transcriptPath: targetFile,
              mtime: stat.mtime
            })
          }
        }
      }
    } catch (err) {
      debug('transcript-parser', `Error reading brain directory ${brainDir}`, err)
    }
  }

  // Search in history directories
  const historyDirs = getAntigravityHistoryDirs()
  for (const histDir of historyDirs) {
    if (!existsSync(histDir)) continue

    try {
      const files = readdirSync(histDir)
      for (const file of files) {
        if (file.endsWith('.jsonl') || file.endsWith('.json')) {
          const conversationId = file.replace(/\.(jsonl|json)$/, '')
          if (!found.has(conversationId)) {
            const filePath = join(histDir, file)
            const stat = statSync(filePath)
            found.set(conversationId, {
              conversationId,
              transcriptPath: filePath,
              mtime: stat.mtime
            })
          }
        }
      }
    } catch (err) {
      debug('transcript-parser', `Error reading history directory ${histDir}`, err)
    }
  }

  // Sort by mtime descending (most recent first)
  return Array.from(found.values()).sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
}

/**
 * Parse a single transcript file into AgentSessionUsage
 */
export function parseTranscript(conversationId: string, transcriptPath: string): AgentSessionUsage | null {
  if (!existsSync(transcriptPath)) return null

  try {
    const rawContent = readFileSync(transcriptPath, 'utf-8')
    const lines = rawContent.split('\n').filter(line => line.trim().length > 0)

    if (lines.length === 0) return null

    let title: string | undefined
    let startTime: string | undefined
    let lastActiveTime: string | undefined
    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    const steps: AgentStepUsage[] = []
    const modelBreakdown: Record<string, ModelUsageStats> = {}
    const toolCallsBreakdown: Record<string, number> = {}

    for (let i = 0; i < lines.length; i++) {
      let parsed: any
      try {
        parsed = JSON.parse(lines[i])
      } catch {
        continue
      }

      const stepIndex = typeof parsed.step_index === 'number' ? parsed.step_index : i
      const type = parsed.type || 'STEP'
      const source = parsed.source || 'UNKNOWN'
      const timestamp = parsed.timestamp || parsed.created_at || undefined

      if (!startTime && timestamp) {
        startTime = timestamp
      }
      if (timestamp) {
        lastActiveTime = timestamp
      }

      // Extract conversation title from initial user prompt
      if (!title && (type === 'USER_INPUT' || source === 'USER_EXPLICIT' || source === 'USER')) {
        const text = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content || '')
        const cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        if (cleanText.length > 0) {
          title = cleanText.length > 60 ? cleanText.substring(0, 57) + '...' : cleanText
        }
      }

      // Parse tool calls
      const toolNames: string[] = []
      if (Array.isArray(parsed.tool_calls)) {
        for (const tc of parsed.tool_calls) {
          const toolName = tc.name || tc.tool || tc.function?.name || 'unknown_tool'
          toolNames.push(toolName)
          toolCallsBreakdown[toolName] = (toolCallsBreakdown[toolName] || 0) + 1
        }
      }

      // Parse or estimate token counts
      let promptTokens = 0
      let completionTokens = 0
      let modelId: string | undefined = parsed.model || parsed.model_id

      if (parsed.usageMetadata) {
        promptTokens = parsed.usageMetadata.promptTokenCount || 0
        completionTokens = parsed.usageMetadata.candidatesTokenCount || 0
        if (!modelId) modelId = 'gemini-agent'
      } else if (parsed.usage) {
        promptTokens = parsed.usage.prompt_tokens || parsed.usage.input_tokens || 0
        completionTokens = parsed.usage.completion_tokens || parsed.usage.output_tokens || 0
        if (!modelId) modelId = 'gemini-agent'
      } else if (source === 'MODEL' || type === 'PLANNER_RESPONSE') {
        // Fallback token estimation for model responses without explicit usage metadata
        const contentStr = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content || '')
        completionTokens = estimateTokens(contentStr)
        promptTokens = Math.max(100, Math.round(completionTokens * 1.5))
        if (!modelId) modelId = 'gemini-agent'
      }

      const totalTokens = (promptTokens || 0) + (completionTokens || 0)
      totalPromptTokens += promptTokens
      totalCompletionTokens += completionTokens

      if (modelId) {
        if (!modelBreakdown[modelId]) {
          modelBreakdown[modelId] = {
            modelId,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            turns: 0
          }
        }
        modelBreakdown[modelId].promptTokens += promptTokens
        modelBreakdown[modelId].completionTokens += completionTokens
        modelBreakdown[modelId].totalTokens += totalTokens
        modelBreakdown[modelId].turns += 1
      }

      steps.push({
        stepIndex,
        type,
        source,
        modelId,
        promptTokens,
        completionTokens,
        totalTokens,
        toolCallsCount: toolNames.length,
        toolNames,
        timestamp
      })
    }

    const stat = statSync(transcriptPath)
    if (!lastActiveTime) {
      lastActiveTime = stat.mtime.toISOString()
    }
    if (!startTime) {
      startTime = stat.birthtime.toISOString()
    }

    return {
      conversationId,
      title: title || `Conversation ${conversationId.slice(0, 8)}`,
      transcriptPath,
      startTime,
      lastActiveTime,
      stepCount: steps.length,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      modelBreakdown,
      toolCallsBreakdown,
      steps
    }
  } catch (err) {
    debug('transcript-parser', `Failed to parse transcript ${transcriptPath}`, err)
    return null
  }
}
