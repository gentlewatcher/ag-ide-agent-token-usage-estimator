/**
 * Types for Implementation Plan & Action Archiving, and Pre-Execution Usage Estimation
 */

export interface ArchivedPlanFile {
  actionType: 'NEW' | 'MODIFY' | 'DELETE' | 'VIEW'
  filePath: string
  basename: string
}

export interface ModelTokenStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  stepCount: number
}

export interface ModelRatioProfile {
  modelId: string
  displayName: string
  sampleCount: number
  promptRatio: number // relative to baseline (1.0)
  completionRatio: number
  totalRatio: number
  avgTokensPerStep: number
  confidence: number // 0.0 to 1.0 based on sample size
  isPrior: boolean // true if purely prior, false if backed by empirical observations
}

export interface ModelRatioMatrix {
  baselineModel: string
  lastUpdated: string
  totalSamples: number
  models: Record<string, ModelRatioProfile>
}

export interface ArchivedActionRecord {
  id: string
  conversationId: string
  timestamp: string
  title?: string
  promptText: string
  planMarkdown?: string
  walkthroughMarkdown?: string
  plannedFiles: ArchivedPlanFile[]
  executedTools: string[]
  toolCallCounts: Record<string, number>
  promptTokens: number
  completionTokens: number
  totalTokens: number
  stepCount: number
  primaryModel: string
  modelsUsed: string[]
  modelTokenBreakdown?: Record<string, ModelTokenStats>
  keywords: string[]
}

export interface SimilarityMatch {
  record: ArchivedActionRecord
  similarityScore: number // 0.0 to 1.0
  matchedKeywords: string[]
  matchedFiles: string[]
}

export interface UsageEstimationResult {
  sourceType: 'prompt' | 'plan'
  inputPreview: string
  plannedFilesCount: number
  targetModel: string
  modelRatioMultiplier: number
  estimatedTokens: {
    min: number
    avg: number
    max: number
    confidence: number // 0.0 to 1.0
  }
  estimatedPromptTokens: number
  estimatedCompletionTokens: number
  estimatedToolCalls: {
    min: number
    avg: number
    max: number
  }
  likelyTools: Array<{
    toolName: string
    probability: number // 0.0 to 1.0
    estimatedCount: number
  }>
  estimatedSteps: number
  matchedRecords: Array<{
    id: string
    title: string
    primaryModel: string
    similarityScore: number
    tokensUsed: number
    scaledTokensUsed: number
    toolCount: number
  }>
  statusBarBadge: string
  statusBarTooltip: string
}

export interface StatusBarBadgePayload {
  text: string
  tooltip: string
  command?: string
  severity?: 'info' | 'warning' | 'normal'
  targetModel: string
  estimatedTokens: number
  estimatedTools: number
  confidence: number
}

export interface EstimateOptions {
  prompt?: string
  planPath?: string
  model?: string
  json?: boolean
  badge?: boolean
  sync?: boolean
  ratios?: boolean
  limit?: string
}
