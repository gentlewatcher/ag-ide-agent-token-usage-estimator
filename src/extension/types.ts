/**
 * Types and interfaces for Antigravity IDE Status Bar Extension
 */

import type { UsageEstimationResult } from '../estimation/types.js'
import type { QuotaSnapshot } from '../quota/types.js'

export interface ExtensionConfig {
  defaultModel: string
  statusBarDisplayMode: 'detailed' | 'compact' | 'model-tag' | 'minimal'
  tokenWarningThreshold: number
  refreshInterval: number
  showModelName: boolean
  showCountdown: boolean
  autoSyncTranscripts: boolean
}

export interface StatusBarEvaluationContext {
  activeDocumentText?: string
  activeDocumentPath?: string
  isPlanDocument?: boolean
}

export interface StatusBarState {
  lastEstimation?: UsageEstimationResult
  lastQuotaSnapshot?: QuotaSnapshot
  lastEvaluatedPath?: string
  lastEvaluatedType?: 'prompt' | 'plan'
  isEvaluating: boolean
}
