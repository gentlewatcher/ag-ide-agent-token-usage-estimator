/**
 * Formatter for Agent token and usage metrics
 */

import Table from 'cli-table3'
import type { AgentOverallStats, AgentSessionUsage } from './types.js'

/**
 * Format large numbers with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Format relative date or ISO timestamp
 */
function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return 'unknown'
  try {
    const d = new Date(timestamp)
    return d.toLocaleString()
  } catch {
    return timestamp
  }
}

/**
 * Print overall agent statistics summary
 */
export function printAgentSummary(stats: AgentOverallStats): void {
  console.log('\n🤖 \x1b[1mAntigravity Agent Usage & Token Analytics\x1b[0m\n')

  // Top summary table
  const summaryTable = new Table({
    head: ['\x1b[1mMetric\x1b[0m', '\x1b[1mCount / Usage\x1b[0m'],
    style: { head: [], border: [] }
  })

  summaryTable.push(
    ['Total Conversations Analyzed', formatNumber(stats.totalSessions)],
    ['Total Agent Steps / Turns', formatNumber(stats.totalSteps)],
    ['Total Prompt (Input) Tokens', formatNumber(stats.totalPromptTokens)],
    ['Total Candidates (Output) Tokens', formatNumber(stats.totalCompletionTokens)],
    ['\x1b[32mGrand Total Tokens\x1b[0m', `\x1b[32m\x1b[1m${formatNumber(stats.totalTokens)}\x1b[0m`]
  )

  console.log(summaryTable.toString())

  // Model breakdown table
  const models = Object.values(stats.modelUsage)
  if (models.length > 0) {
    console.log('\n📊 \x1b[1mModel Distribution\x1b[0m')
    const modelTable = new Table({
      head: ['\x1b[1mModel\x1b[0m', '\x1b[1mTurns\x1b[0m', '\x1b[1mInput Tokens\x1b[0m', '\x1b[1mOutput Tokens\x1b[0m', '\x1b[1mTotal Tokens\x1b[0m', '\x1b[1mShare\x1b[0m'],
      style: { head: [], border: [] }
    })

    for (const m of models.sort((a, b) => b.totalTokens - a.totalTokens)) {
      const share = stats.totalTokens > 0 ? ((m.totalTokens / stats.totalTokens) * 100).toFixed(1) + '%' : '0%'
      modelTable.push([
        m.modelId,
        formatNumber(m.turns),
        formatNumber(m.promptTokens),
        formatNumber(m.completionTokens),
        formatNumber(m.totalTokens),
        share
      ])
    }
    console.log(modelTable.toString())
  }

  // Top tools table
  const tools = Object.entries(stats.toolUsage).sort((a, b) => b[1] - a[1])
  if (tools.length > 0) {
    console.log('\n🛠️  \x1b[1mTop Tool Executions\x1b[0m')
    const toolTable = new Table({
      head: ['\x1b[1mTool Name\x1b[0m', '\x1b[1mExecutions\x1b[0m'],
      style: { head: [], border: [] }
    })

    for (const [name, count] of tools.slice(0, 10)) {
      toolTable.push([name, formatNumber(count)])
    }
    console.log(toolTable.toString())
  }

  // Recent sessions preview
  if (stats.recentSessions.length > 0) {
    console.log('\n💬 \x1b[1mRecent Agent Conversations\x1b[0m')
    printAgentSessionsTable(stats.recentSessions)
  }

  console.log('')
}

/**
 * Print sessions list table
 */
export function printAgentSessionsTable(sessions: AgentSessionUsage[]): void {
  const table = new Table({
    head: ['\x1b[1mID\x1b[0m', '\x1b[1mTitle\x1b[0m', '\x1b[1mSteps\x1b[0m', '\x1b[1mTokens\x1b[0m', '\x1b[1mLast Active\x1b[0m'],
    style: { head: [], border: [] }
  })

  for (const s of sessions) {
    const shortId = s.conversationId.length > 12 ? s.conversationId.slice(0, 12) + '...' : s.conversationId
    table.push([
      shortId,
      s.title || 'Untitled',
      formatNumber(s.stepCount),
      formatNumber(s.totalTokens),
      formatTimestamp(s.lastActiveTime)
    ])
  }

  console.log(table.toString())
}

/**
 * Print detailed breakdown for a single session
 */
export function printAgentSessionDetail(session: AgentSessionUsage): void {
  console.log(`\n💬 \x1b[1mAgent Conversation Details\x1b[0m: ${session.conversationId}`)
  console.log(`Title: ${session.title || 'Untitled'}`)
  console.log(`Log File: ${session.transcriptPath}`)
  console.log(`Steps: ${formatNumber(session.stepCount)} | Total Tokens: ${formatNumber(session.totalTokens)} | Active: ${formatTimestamp(session.lastActiveTime)}\n`)

  const stepTable = new Table({
    head: ['\x1b[1m#\x1b[0m', '\x1b[1mType\x1b[0m', '\x1b[1mSource\x1b[0m', '\x1b[1mPrompt\x1b[0m', '\x1b[1mCompletion\x1b[0m', '\x1b[1mTotal\x1b[0m', '\x1b[1mTools\x1b[0m'],
    style: { head: [], border: [] }
  })

  for (const step of session.steps) {
    stepTable.push([
      step.stepIndex,
      step.type,
      step.source,
      formatNumber(step.promptTokens || 0),
      formatNumber(step.completionTokens || 0),
      formatNumber(step.totalTokens || 0),
      step.toolCallsCount > 0 ? `${step.toolCallsCount} (${step.toolNames.join(', ')})` : '-'
    ])
  }

  console.log(stepTable.toString())
  console.log('')
}

/**
 * Print agent usage as JSON
 */
export function printAgentJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}
