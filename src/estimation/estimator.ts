/**
 * Similarity matching and usage estimation engine with cross-model statistical scaling
 */

import { getArchivedRecords, extractKeywords, extractPlannedFiles } from './archive-store.js'
import { formatStatusBarBadge, formatStatusBarTooltip } from './badge-formatter.js'
import { 
  scaleTokensBetweenModels, 
  getModelRatios, 
  BASELINE_MODEL, 
  getModelPrior 
} from './model-ratios.js'
import type { 
  ArchivedActionRecord, 
  SimilarityMatch, 
  UsageEstimationResult 
} from './types.js'

/**
 * Calculate Jaccard similarity score between two keyword sets
 */
function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): { score: number; overlap: string[] } {
  if (setA.size === 0 || setB.size === 0) {
    return { score: 0, overlap: [] }
  }

  const overlap: string[] = []
  for (const item of setA) {
    if (setB.has(item)) {
      overlap.push(item)
    }
  }

  const unionSize = new Set([...setA, ...setB]).size
  const score = unionSize > 0 ? overlap.length / unionSize : 0

  return { score, overlap }
}

/**
 * Find similarity matches between input text/plan and historical records
 */
export function findSimilarRecords(
  inputText: string, 
  records: ArchivedActionRecord[]
): SimilarityMatch[] {
  const inputKeywords = new Set(extractKeywords(inputText))
  const inputFiles = new Set(extractPlannedFiles(inputText).map(f => f.basename.toLowerCase()))
  const matches: SimilarityMatch[] = []

  for (const record of records) {
    const recordKeywords = new Set(record.keywords)
    const recordFiles = new Set(record.plannedFiles.map(f => f.basename.toLowerCase()))

    const { score: keywordScore, overlap: matchedKeywords } = calculateJaccardSimilarity(inputKeywords, recordKeywords)

    // File overlap bonus
    let fileOverlapScore = 0
    const matchedFiles: string[] = []
    if (inputFiles.size > 0 && recordFiles.size > 0) {
      const { score: fScore, overlap: fOverlap } = calculateJaccardSimilarity(inputFiles, recordFiles)
      fileOverlapScore = fScore
      matchedFiles.push(...fOverlap)
    }

    // Combined score (70% keyword similarity + 30% file overlap if files present)
    const combinedScore = inputFiles.size > 0
      ? keywordScore * 0.7 + fileOverlapScore * 0.3
      : keywordScore

    if (combinedScore > 0.03 || matchedKeywords.length >= 2) {
      matches.push({
        record,
        similarityScore: combinedScore,
        matchedKeywords,
        matchedFiles
      })
    }
  }

  return matches.sort((a, b) => b.similarityScore - a.similarityScore)
}

/**
 * Estimate token and tool usage for an unexecuted prompt or proposed implementation plan,
 * scaling across model statistical ratio profiles.
 */
export function estimateUsage(
  input: string, 
  sourceType: 'prompt' | 'plan' = 'prompt',
  targetModel: string = BASELINE_MODEL
): UsageEstimationResult {
  const records = getArchivedRecords()
  const matches = findSimilarRecords(input, records)
  const plannedFiles = extractPlannedFiles(input)
  const ratioMatrix = getModelRatios()
  const targetProfile = ratioMatrix.models[targetModel.toLowerCase()] || { totalRatio: getModelPrior(targetModel).total }
  const modelRatioMultiplier = targetProfile.totalRatio || 1.0

  let inputPreview = input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  if (inputPreview.length > 80) {
    inputPreview = inputPreview.substring(0, 77) + '...'
  }

  // If we have strong historical matches
  if (matches.length > 0) {
    const topMatches = matches.slice(0, 5)
    const totalWeights = topMatches.reduce((acc, m) => acc + Math.max(0.1, m.similarityScore), 0)

    // Apply cross-model scaling to historical token measurements
    const scaledMatches = topMatches.map(m => {
      const sourceModel = m.record.primaryModel || BASELINE_MODEL
      const { scaledTokens } = scaleTokensBetweenModels(m.record.totalTokens, sourceModel, targetModel, ratioMatrix)
      return {
        ...m,
        scaledTokens
      }
    })

    const tokenCounts = scaledMatches.map(m => m.scaledTokens).filter(t => t > 0)
    const toolCounts = topMatches.map(m => Object.values(m.record.toolCallCounts).reduce((a, b) => a + b, 0))
    const stepCounts = topMatches.map(m => m.record.stepCount).filter(s => s > 0)

    const minTokens = tokenCounts.length > 0 ? Math.min(...tokenCounts) : Math.round(10000 * modelRatioMultiplier)
    const maxTokens = tokenCounts.length > 0 ? Math.max(...tokenCounts) : Math.round(50000 * modelRatioMultiplier)
    const weightedAvgTokens = Math.round(
      scaledMatches.reduce((acc, m) => acc + m.scaledTokens * Math.max(0.1, m.similarityScore), 0) / totalWeights
    )

    const minTools = toolCounts.length > 0 ? Math.min(...toolCounts) : 2
    const maxTools = toolCounts.length > 0 ? Math.max(...toolCounts) : 15
    const avgTools = Math.round(
      topMatches.reduce((acc, m) => acc + (Object.values(m.record.toolCallCounts).reduce((a, b) => a + b, 0)) * Math.max(0.1, m.similarityScore), 0) / totalWeights
    )

    const avgSteps = stepCounts.length > 0
      ? Math.round(stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length)
      : Math.max(3, Math.round(avgTools * 1.5))

    // Aggregate tool probabilities
    const toolFreqMap: Record<string, { totalOccurrences: number; matchedRecordsCount: number }> = {}
    for (const m of topMatches) {
      for (const [toolName, count] of Object.entries(m.record.toolCallCounts)) {
        if (!toolFreqMap[toolName]) {
          toolFreqMap[toolName] = { totalOccurrences: 0, matchedRecordsCount: 0 }
        }
        toolFreqMap[toolName].totalOccurrences += count
        toolFreqMap[toolName].matchedRecordsCount += 1
      }
    }

    const likelyTools = Object.entries(toolFreqMap)
      .map(([toolName, data]) => ({
        toolName,
        probability: Math.min(1.0, data.matchedRecordsCount / topMatches.length),
        estimatedCount: Math.max(1, Math.round(data.totalOccurrences / topMatches.length))
      }))
      .sort((a, b) => b.probability - a.probability || b.estimatedCount - a.estimatedCount)

    const confidence = Math.min(0.95, Math.max(0.35, topMatches[0].similarityScore * 1.8))

    const result: UsageEstimationResult = {
      sourceType,
      inputPreview,
      plannedFilesCount: plannedFiles.length,
      targetModel,
      modelRatioMultiplier,
      estimatedTokens: {
        min: minTokens,
        avg: weightedAvgTokens || Math.round((minTokens + maxTokens) / 2),
        max: maxTokens,
        confidence
      },
      estimatedPromptTokens: Math.round(weightedAvgTokens * 0.7),
      estimatedCompletionTokens: Math.round(weightedAvgTokens * 0.3),
      estimatedToolCalls: {
        min: minTools,
        avg: avgTools,
        max: maxTools
      },
      likelyTools,
      estimatedSteps: avgSteps,
      matchedRecords: scaledMatches.map(m => ({
        id: m.record.conversationId,
        title: m.record.title || m.record.promptText.slice(0, 50),
        primaryModel: m.record.primaryModel || BASELINE_MODEL,
        similarityScore: Math.round(m.similarityScore * 100) / 100,
        tokensUsed: m.record.totalTokens,
        scaledTokensUsed: m.scaledTokens,
        toolCount: Object.values(m.record.toolCallCounts).reduce((a, b) => a + b, 0)
      })),
      statusBarBadge: '',
      statusBarTooltip: ''
    }

    result.statusBarBadge = formatStatusBarBadge(result)
    result.statusBarTooltip = formatStatusBarTooltip(result)

    return result
  }

  // Cold start / heuristic fallback when no close historical match is found
  const fileCountMultiplier = Math.max(1, plannedFiles.length)
  const estimatedMinTokens = Math.round(12000 * fileCountMultiplier * modelRatioMultiplier)
  const estimatedAvgTokens = Math.round(28000 * fileCountMultiplier * modelRatioMultiplier)
  const estimatedMaxTokens = Math.round(65000 * fileCountMultiplier * modelRatioMultiplier)

  const fallbackResult: UsageEstimationResult = {
    sourceType,
    inputPreview,
    plannedFilesCount: plannedFiles.length,
    targetModel,
    modelRatioMultiplier,
    estimatedTokens: {
      min: estimatedMinTokens,
      avg: estimatedAvgTokens,
      max: estimatedMaxTokens,
      confidence: 0.40
    },
    estimatedPromptTokens: Math.round(estimatedAvgTokens * 0.7),
    estimatedCompletionTokens: Math.round(estimatedAvgTokens * 0.3),
    estimatedToolCalls: {
      min: 2 * fileCountMultiplier,
      avg: 5 * fileCountMultiplier,
      max: 12 * fileCountMultiplier
    },
    likelyTools: [
      { toolName: 'view_file', probability: 0.90, estimatedCount: 2 * fileCountMultiplier },
      { toolName: 'replace_file_content', probability: 0.85, estimatedCount: 2 * fileCountMultiplier },
      { toolName: 'run_command', probability: 0.75, estimatedCount: 2 * fileCountMultiplier }
    ],
    estimatedSteps: 4 * fileCountMultiplier,
    matchedRecords: [],
    statusBarBadge: '',
    statusBarTooltip: ''
  }

  fallbackResult.statusBarBadge = formatStatusBarBadge(fallbackResult)
  fallbackResult.statusBarTooltip = formatStatusBarTooltip(fallbackResult)

  return fallbackResult
}
