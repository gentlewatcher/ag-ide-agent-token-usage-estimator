import { describe, it, expect } from 'vitest'
import { estimateUsage } from '../../src/estimation/estimator.js'
import { formatStatusBarBadge, formatStatusBarTooltip } from '../../src/estimation/badge-formatter.js'

describe('Extension Status Bar Formatter and Estimations', () => {
  it('formats status bar badge with prompt estimation', () => {
    const estimation = estimateUsage('Port oauth credentials to antigravity', 'prompt', 'gemini-3.7-pro')
    const badge = formatStatusBarBadge(estimation)

    expect(badge).toContain('⚡')
    expect(badge).toContain('tok')
    expect(badge).toContain('tools')
    expect(badge).toContain('[gemini-3.7-pro]')
  })

  it('generates rich markdown tooltip for hover card', () => {
    const estimation = estimateUsage('## Proposed Changes\n- [NEW] status bar controller', 'plan', 'claude-3-7-sonnet')
    const tooltip = formatStatusBarTooltip(estimation)

    expect(tooltip).toContain('### ⚡ Antigravity Pre-Execution Usage Estimation')
    expect(tooltip).toContain('claude-3-7-sonnet')
    expect(tooltip).toContain('Total Tokens')
    expect(tooltip).toContain('Tool Calls')
  })
})
