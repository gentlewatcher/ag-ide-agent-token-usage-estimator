/**
 * Statistical ratio matrix and cross-model usage profile scaling engine
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getGeminiHomeDir } from '../core/env.js'
import { debug } from '../core/logger.js'
import type { 
  ArchivedActionRecord, 
  ModelRatioMatrix, 
  ModelRatioProfile 
} from './types.js'

export const BASELINE_MODEL = 'gemini-3.7-flash'

/**
 * Built-in baseline prior ratio profiles for standard model families
 */
export const DEFAULT_MODEL_PRIORS: Record<string, { prompt: number; completion: number; total: number; displayName: string }> = {
  'gemini-3.7-flash': { prompt: 1.0, completion: 1.0, total: 1.0, displayName: 'Gemini 3.7 Flash (Baseline)' },
  'gemini-2.5-flash': { prompt: 0.95, completion: 0.90, total: 0.93, displayName: 'Gemini 2.5 Flash' },
  'gemini-3.7-pro': { prompt: 1.15, completion: 1.85, total: 1.45, displayName: 'Gemini 3.7 Pro' },
  'gemini-2.5-pro': { prompt: 1.10, completion: 1.75, total: 1.40, displayName: 'Gemini 2.5 Pro' },
  'claude-3-7-sonnet': { prompt: 1.20, completion: 2.10, total: 1.60, displayName: 'Claude 3.7 Sonnet' },
  'claude-3-5-sonnet': { prompt: 1.15, completion: 1.90, total: 1.50, displayName: 'Claude 3.5 Sonnet' },
  'gpt-4o': { prompt: 1.10, completion: 1.60, total: 1.35, displayName: 'GPT-4o' },
  'deepseek-r1': { prompt: 1.25, completion: 2.60, total: 1.85, displayName: 'DeepSeek R1' },
  'gemma-2': { prompt: 0.90, completion: 0.80, total: 0.85, displayName: 'Gemma 2 (Local)' }
}

/**
 * Resolve prior ratio for any arbitrary or unknown model ID
 */
export function getModelPrior(modelId: string): { prompt: number; completion: number; total: number; displayName: string } {
  const normalized = (modelId || '').toLowerCase().trim()

  if (DEFAULT_MODEL_PRIORS[normalized]) {
    return DEFAULT_MODEL_PRIORS[normalized]
  }

  // Fallback heuristic based on substring patterns
  if (normalized.includes('pro')) {
    return { prompt: 1.15, completion: 1.80, total: 1.45, displayName: modelId }
  }
  if (normalized.includes('flash')) {
    return { prompt: 1.00, completion: 1.00, total: 1.00, displayName: modelId }
  }
  if (normalized.includes('sonnet')) {
    return { prompt: 1.20, completion: 2.00, total: 1.55, displayName: modelId }
  }
  if (normalized.includes('opus')) {
    return { prompt: 1.30, completion: 2.40, total: 1.90, displayName: modelId }
  }
  if (normalized.includes('r1') || normalized.includes('reason') || normalized.includes('think')) {
    return { prompt: 1.25, completion: 2.50, total: 1.80, displayName: modelId }
  }
  if (normalized.includes('gemma') || normalized.includes('local') || normalized.includes('mini') || normalized.includes('small')) {
    return { prompt: 0.90, completion: 0.80, total: 0.85, displayName: modelId }
  }

  return { prompt: 1.05, completion: 1.35, total: 1.20, displayName: modelId }
}

/**
 * Get storage path for the persistent model ratios file
 */
export function getModelRatiosStoragePath(): string {
  const archiveDir = join(getGeminiHomeDir(), 'antigravity-usage', 'action_archive')
  return join(archiveDir, 'model_ratios.json')
}

/**
 * Load or initialize the model ratio matrix
 */
export function getModelRatios(): ModelRatioMatrix {
  const filePath = getModelRatiosStoragePath()

  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as ModelRatioMatrix
    } catch (err) {
      debug('model-ratios', 'Failed to read model_ratios.json', err)
    }
  }

  // Initialize with baseline priors
  const models: Record<string, ModelRatioProfile> = {}
  for (const [id, prior] of Object.entries(DEFAULT_MODEL_PRIORS)) {
    models[id] = {
      modelId: id,
      displayName: prior.displayName,
      sampleCount: 0,
      promptRatio: prior.prompt,
      completionRatio: prior.completion,
      totalRatio: prior.total,
      avgTokensPerStep: Math.round(3000 * prior.total),
      confidence: id === BASELINE_MODEL ? 0.90 : 0.40,
      isPrior: true
    }
  }

  return {
    baselineModel: BASELINE_MODEL,
    lastUpdated: new Date().toISOString(),
    totalSamples: 0,
    models
  }
}

/**
 * Save model ratio matrix to disk
 */
export function saveModelRatios(matrix: ModelRatioMatrix): void {
  const filePath = getModelRatiosStoragePath()
  const dir = join(getGeminiHomeDir(), 'antigravity-usage', 'action_archive')

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(filePath, JSON.stringify(matrix, null, 2), 'utf-8')
    debug('model-ratios', `Saved model ratio matrix with ${Object.keys(matrix.models).length} models`)
  } catch (err) {
    debug('model-ratios', 'Failed to save model_ratios.json', err)
  }
}

/**
 * Recompute statistical model ratio matrix from historical execution records using Bayesian Smoothing
 */
export function recomputeModelRatios(records: ArchivedActionRecord[]): ModelRatioMatrix {
  const matrix = getModelRatios()
  const modelStats: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number; stepCount: number; sampleCount: number }> = {}

  // Aggregate stats across records
  for (const r of records) {
    const model = r.primaryModel || (r.modelsUsed && r.modelsUsed[0]) || BASELINE_MODEL
    const normModel = model.toLowerCase().trim()

    if (!modelStats[normModel]) {
      modelStats[normModel] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, stepCount: 0, sampleCount: 0 }
    }

    modelStats[normModel].promptTokens += r.promptTokens || 0
    modelStats[normModel].completionTokens += r.completionTokens || 0
    modelStats[normModel].totalTokens += r.totalTokens || 0
    modelStats[normModel].stepCount += r.stepCount || 1
    modelStats[normModel].sampleCount += 1
  }

  // Calculate baseline metrics (per step)
  const baselineStats = modelStats[BASELINE_MODEL]
  const baselineTokensPerStep = baselineStats && baselineStats.stepCount > 0
    ? baselineStats.totalTokens / baselineStats.stepCount
    : 2500
  const baselinePromptPerStep = baselineStats && baselineStats.stepCount > 0
    ? baselineStats.promptTokens / baselineStats.stepCount
    : 1750
  const baselineCompletionPerStep = baselineStats && baselineStats.stepCount > 0
    ? baselineStats.completionTokens / baselineStats.stepCount
    : 750

  const PRIOR_WEIGHT = 4 // K parameter for Bayesian smoothing

  // Update profiles for all observed models
  for (const [modelId, stats] of Object.entries(modelStats)) {
    const prior = getModelPrior(modelId)
    const n = stats.sampleCount
    const steps = Math.max(1, stats.stepCount)

    const empPromptPerStep = stats.promptTokens / steps
    const empCompletionPerStep = stats.completionTokens / steps
    const empTotalPerStep = stats.totalTokens / steps

    const empPromptRatio = baselinePromptPerStep > 0 ? empPromptPerStep / baselinePromptPerStep : prior.prompt
    const empCompletionRatio = baselineCompletionPerStep > 0 ? empCompletionPerStep / baselineCompletionPerStep : prior.completion
    const empTotalRatio = baselineTokensPerStep > 0 ? empTotalPerStep / baselineTokensPerStep : prior.total

    // Bayesian Smoothing: (N * empirical + K * prior) / (N + K)
    const smoothedPromptRatio = (n * empPromptRatio + PRIOR_WEIGHT * prior.prompt) / (n + PRIOR_WEIGHT)
    const smoothedCompletionRatio = (n * empCompletionRatio + PRIOR_WEIGHT * prior.completion) / (n + PRIOR_WEIGHT)
    const smoothedTotalRatio = (n * empTotalRatio + PRIOR_WEIGHT * prior.total) / (n + PRIOR_WEIGHT)

    const confidence = Math.min(0.98, (n + 2) / (n + 8))

    matrix.models[modelId] = {
      modelId,
      displayName: prior.displayName || modelId,
      sampleCount: n,
      promptRatio: Math.round(smoothedPromptRatio * 100) / 100,
      completionRatio: Math.round(smoothedCompletionRatio * 100) / 100,
      totalRatio: Math.round(smoothedTotalRatio * 100) / 100,
      avgTokensPerStep: Math.round(empTotalPerStep),
      confidence: Math.round(confidence * 100) / 100,
      isPrior: n === 0
    }
  }

  matrix.totalSamples = records.length
  matrix.lastUpdated = new Date().toISOString()

  saveModelRatios(matrix)
  return matrix
}

/**
 * Scale token counts between source execution model and target estimation model
 */
export function scaleTokensBetweenModels(
  tokens: number,
  sourceModel: string,
  targetModel: string,
  matrix?: ModelRatioMatrix
): { scaledTokens: number; multiplier: number; sourceRatio: number; targetRatio: number } {
  if (!tokens || tokens <= 0) {
    return { scaledTokens: 0, multiplier: 1.0, sourceRatio: 1.0, targetRatio: 1.0 }
  }

  const mat = matrix || getModelRatios()
  const normSource = (sourceModel || BASELINE_MODEL).toLowerCase().trim()
  const normTarget = (targetModel || BASELINE_MODEL).toLowerCase().trim()

  if (normSource === normTarget) {
    return { scaledTokens: tokens, multiplier: 1.0, sourceRatio: 1.0, targetRatio: 1.0 }
  }

  const sourceProfile = mat.models[normSource] || { totalRatio: getModelPrior(normSource).total }
  const targetProfile = mat.models[normTarget] || { totalRatio: getModelPrior(normTarget).total }

  const sourceRatio = sourceProfile.totalRatio || 1.0
  const targetRatio = targetProfile.totalRatio || 1.0

  const multiplier = targetRatio / sourceRatio
  const scaledTokens = Math.round(tokens * multiplier)

  return {
    scaledTokens,
    multiplier: Math.round(multiplier * 100) / 100,
    sourceRatio,
    targetRatio
  }
}
