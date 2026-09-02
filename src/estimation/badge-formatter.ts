/**
 * Formatter for status bar badges, estimation reports, and statistical model ratio tables
 */

import Table from 'cli-table3'
import type { UsageEstimationResult, ModelRatioMatrix } from './types.js'

function formatNumber(num: number): string {
  return num.toLocaleString()
}

function formatCompactTokens(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

/**
 * Format compact badge string for IDE bottom status bar
 */
export function formatStatusBarBadge(result: UsageEstimationResult): string {
  const tokenStr = formatCompactTokens(result.estimatedTokens.avg)
  const toolStr = result.estimatedToolCalls.avg
  const confPercent = Math.round(result.estimatedTokens.confidence * 100)
  const modelPart = result.targetModel && result.targetModel !== 'gemini-3.7-flash'
    ? ` [${result.targetModel}]`
    : ''

  return `⚡ ~${tokenStr} tok | ${toolStr} tools (${confPercent}%)${modelPart}`
}

/**
 * Format detailed markdown tooltip for IDE status bar hover
 */
export function formatStatusBarTooltip(result: UsageEstimationResult): string {
  const confPercent = Math.round(result.estimatedTokens.confidence * 100)
  const modelMultiplierStr = result.modelRatioMultiplier !== 1.0
    ? ` (${result.modelRatioMultiplier}x scaling relative to Flash baseline)`
    : ''

  let md = `### ⚡ Antigravity Pre-Execution Usage Estimation\n\n`
  md += `**Target Type**: ${result.sourceType === 'plan' ? 'Proposed Implementation Plan' : 'Unsubmitted Prompt'}\n`
  md += `**Target Model**: \`${result.targetModel}\`${modelMultiplierStr}\n`
  md += `**Confidence**: ${confPercent}%\n\n`
  md += `| Metric | Estimated Range | Average |\n`
  md += `| :--- | :--- | :--- |\n`
  md += `| **Total Tokens** | ${formatNumber(result.estimatedTokens.min)} – ${formatNumber(result.estimatedTokens.max)} | **~${formatNumber(result.estimatedTokens.avg)}** |\n`
  md += `| **Prompt Tokens** | — | ~${formatNumber(result.estimatedPromptTokens)} |\n`
  md += `| **Completion Tokens** | — | ~${formatNumber(result.estimatedCompletionTokens)} |\n`
  md += `| **Tool Executions** | ${result.estimatedToolCalls.min} – ${result.estimatedToolCalls.max} calls | **~${result.estimatedToolCalls.avg} calls** |\n`
  md += `| **Agent Steps** | — | ~${result.estimatedSteps} steps |\n\n`

  if (result.likelyTools.length > 0) {
    md += `#### 🛠️ Predicted Tool Calls:\n`
    for (const tool of result.likelyTools.slice(0, 5)) {
      md += `- \`${tool.toolName}\`: ~${tool.estimatedCount} call(s) (${Math.round(tool.probability * 100)}% likelihood)\n`
    }
    md += `\n`
  }

  if (result.matchedRecords.length > 0) {
    md += `#### 🔍 Matched Historical Tasks:\n`
    for (const match of result.matchedRecords.slice(0, 3)) {
      const modelNote = match.primaryModel ? ` [via ${match.primaryModel}]` : ''
      md += `- **${match.title}** (${formatNumber(match.tokensUsed)} tokens${modelNote}, ${Math.round(match.similarityScore * 100)}% match)\n`
    }
  }

  return md
}

/**
 * Print rich CLI estimation report in terminal
 */
export function printEstimationReport(result: UsageEstimationResult): void {
  console.log('\n🔮 \x1b[1mAntigravity Pre-Execution Usage Estimation\x1b[0m\n')
  console.log(`Source: \x1b[36m${result.sourceType === 'plan' ? 'Proposed Implementation Plan' : 'Prompt Input'}\x1b[0m`)
  console.log(`Target Model: \x1b[33m\x1b[1m${result.targetModel}\x1b[0m ${result.modelRatioMultiplier !== 1.0 ? `(\x1b[35m${result.modelRatioMultiplier}x ratio scaling\x1b[0m)` : ''}`)
  console.log(`Input: "${result.inputPreview}"\n`)

  const summaryTable = new Table({
    head: ['\x1b[1mEstimation Metric\x1b[0m', '\x1b[1mPredicted Value\x1b[0m', '\x1b[1mRange (Min – Max)\x1b[0m'],
    style: { head: [], border: [] }
  })

  summaryTable.push(
    [
      '\x1b[32m\x1b[1mEstimated Total Tokens\x1b[0m',
      `\x1b[32m\x1b[1m~${formatNumber(result.estimatedTokens.avg)}\x1b[0m`,
      `${formatNumber(result.estimatedTokens.min)} – ${formatNumber(result.estimatedTokens.max)}`
    ],
    ['Estimated Prompt Tokens', `~${formatNumber(result.estimatedPromptTokens)}`, '—'],
    ['Estimated Completion Tokens', `~${formatNumber(result.estimatedCompletionTokens)}`, '—'],
    ['Estimated Tool Calls', `~${result.estimatedToolCalls.avg} calls`, `${result.estimatedToolCalls.min} – ${result.estimatedToolCalls.max}`],
    ['Estimated Agent Steps', `~${result.estimatedSteps} steps`, '—'],
    ['Confidence Score', `${Math.round(result.estimatedTokens.confidence * 100)}%`, 'Based on historical similarity']
  )

  console.log(summaryTable.toString())

  if (result.likelyTools.length > 0) {
    console.log('\n🛠️  \x1b[1mPredicted Tool Distribution\x1b[0m')
    const toolTable = new Table({
      head: ['\x1b[1mTool Name\x1b[0m', '\x1b[1mLikelihood\x1b[0m', '\x1b[1mEstimated Count\x1b[0m'],
      style: { head: [], border: [] }
    })

    for (const tool of result.likelyTools) {
      toolTable.push([
        tool.toolName,
        `${Math.round(tool.probability * 100)}%`,
        `~${tool.estimatedCount}`
      ])
    }
    console.log(toolTable.toString())
  }

  if (result.matchedRecords.length > 0) {
    console.log('\n🔍 \x1b[1mSimilar Historical Tasks\x1b[0m')
    const matchTable = new Table({
      head: ['\x1b[1mHistorical Task Title\x1b[0m', '\x1b[1mSource Model\x1b[0m', '\x1b[1mSimilarity\x1b[0m', '\x1b[1mActual Tokens\x1b[0m', '\x1b[1mScaled Tokens\x1b[0m'],
      style: { head: [], border: [] }
    })

    for (const match of result.matchedRecords) {
      const shortTitle = match.title.length > 35 ? match.title.slice(0, 32) + '...' : match.title
      matchTable.push([
        shortTitle,
        match.primaryModel,
        `${Math.round(match.similarityScore * 100)}%`,
        formatNumber(match.tokensUsed),
        `\x1b[32m~${formatNumber(match.scaledTokensUsed)}\x1b[0m`
      ])
    }
    console.log(matchTable.toString())
  }

  console.log(`\n📌 \x1b[1mStatus Bar Badge Preview\x1b[0m: [\x1b[33m${result.statusBarBadge}\x1b[0m]\n`)
}

/**
 * Print statistical model ratio matrix table
 */
export function printModelRatiosTable(matrix: ModelRatioMatrix): void {
  console.log('\n📊 \x1b[1mAntigravity Cross-Model Statistical Ratio Matrix\x1b[0m')
  console.log(`Baseline Model: \x1b[36m${matrix.baselineModel}\x1b[0m (1.0x reference)`)
  console.log(`Total Samples Indexed: \x1b[1m${matrix.totalSamples}\x1b[0m | Last Updated: ${new Date(matrix.lastUpdated).toLocaleString()}\n`)

  const table = new Table({
    head: [
      '\x1b[1mModel Name / ID\x1b[0m',
      '\x1b[1mTotal Ratio\x1b[0m',
      '\x1b[1mPrompt Ratio\x1b[0m',
      '\x1b[1mCompletion Ratio\x1b[0m',
      '\x1b[1mSamples\x1b[0m',
      '\x1b[1mConfidence\x1b[0m',
      '\x1b[1mType\x1b[0m'
    ],
    style: { head: [], border: [] }
  })

  const sortedProfiles = Object.values(matrix.models).sort((a, b) => b.totalRatio - a.totalRatio)

  for (const p of sortedProfiles) {
    const isBaseline = p.modelId === matrix.baselineModel
    const ratioColor = isBaseline ? '\x1b[36m' : p.totalRatio > 1.0 ? '\x1b[33m' : '\x1b[32m'
    const typeLabel = isBaseline
      ? '\x1b[36mBaseline\x1b[0m'
      : p.sampleCount > 0
      ? '\x1b[32mEmpirical\x1b[0m'
      : '\x1b[90mPrior\x1b[0m'

    table.push([
      p.displayName || p.modelId,
      `${ratioColor}\x1b[1m${p.totalRatio.toFixed(2)}x\x1b[0m`,
      `${p.promptRatio.toFixed(2)}x`,
      `${p.completionRatio.toFixed(2)}x`,
      p.sampleCount.toString(),
      `${Math.round(p.confidence * 100)}%`,
      typeLabel
    ])
  }

  console.log(table.toString())
  console.log('\n\x1b[90mNote: Ratios are smoothly calibrated via Bayesian prior smoothing as more executions are recorded in the database.\x1b[0m\n')
}
