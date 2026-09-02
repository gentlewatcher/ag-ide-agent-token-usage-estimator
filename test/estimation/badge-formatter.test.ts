import { describe, it, expect } from 'vitest'
import { formatStatusBarBadge, formatStatusBarTooltip } from '../../src/estimation/badge-formatter.js'
import type { UsageEstimationResult } from '../../src/estimation/types.js'

describe('Badge Formatter', () => {
  const sampleResult: UsageEstimationResult = {
    sourceType: 'plan',
    inputPreview: 'Implementation plan for Porting auth tokens',
    plannedFilesCount: 3,
    estimatedTokens: {
      min: 15000,
      avg: 24500,
      max: 42000,
      confidence: 0.82
    },
    estimatedPromptTokens: 17150,
    estimatedCompletionTokens: 7350,
    estimatedToolCalls: {
      min: 3,
      avg: 6,
      max: 12
    },
    likelyTools: [
      { toolName: 'replace_file_content', probability: 0.90, estimatedCount: 3 },
      { toolName: 'run_command', probability: 0.80, estimatedCount: 2 }
    ],
    estimatedSteps: 8,
    matchedRecords: [
      {
        id: 'conv-abc',
        title: 'Port OAuth authentication',
        similarityScore: 0.85,
        tokensUsed: 22000,
        toolCount: 5
      }
    ],
    statusBarBadge: '',
    statusBarTooltip: ''
  }

  it('formats compact status bar badge', () => {
    const badge = formatStatusBarBadge(sampleResult)
    expect(badge).toBe('⚡ ~24.5k tok | 6 tools (82%)')
  })

  it('formats rich markdown tooltip', () => {
    const tooltip = formatStatusBarTooltip(sampleResult)
    expect(tooltip).toContain('### ⚡ Antigravity Pre-Execution Usage Estimation')
    expect(tooltip).toContain('Proposed Implementation Plan')
    expect(tooltip).toContain('replace_file_content')
    expect(tooltip).toContain('Port OAuth authentication')
  })
})
