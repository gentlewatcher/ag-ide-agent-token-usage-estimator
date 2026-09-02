/**
 * Agent token and usage tracking types
 */

export interface AgentStepUsage {
  stepIndex: number
  type: string
  source: string
  modelId?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  toolCallsCount: number
  toolNames: string[]
  timestamp?: string
}

export interface ModelUsageStats {
  modelId: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  turns: number
}

export interface AgentSessionUsage {
  conversationId: string
  title?: string
  transcriptPath: string
  startTime?: string
  lastActiveTime?: string
  stepCount: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  modelBreakdown: Record<string, ModelUsageStats>
  toolCallsBreakdown: Record<string, number>
  steps: AgentStepUsage[]
}

export interface AgentOverallStats {
  totalSessions: number
  totalSteps: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  modelUsage: Record<string, ModelUsageStats>
  toolUsage: Record<string, number>
  recentSessions: AgentSessionUsage[]
}

export interface AgentUsageFilterOptions {
  limit?: number
  since?: string
  conversationId?: string
  json?: boolean
  detailed?: boolean
}
