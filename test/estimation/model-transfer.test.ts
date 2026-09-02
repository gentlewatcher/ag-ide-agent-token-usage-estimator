import { describe, it, expect } from 'vitest'
import { estimateUsage } from '../../src/estimation/estimator.js'

describe('Cross-Model Usage Transfer Estimation', () => {
  it('estimates usage scaled specifically for requested target model', () => {
    const flashResult = estimateUsage('Port OAuth authentication tokens to antigravity', 'prompt', 'gemini-3.7-flash')
    const proResult = estimateUsage('Port OAuth authentication tokens to antigravity', 'prompt', 'gemini-3.7-pro')
    const claudeResult = estimateUsage('Port OAuth authentication tokens to antigravity', 'prompt', 'claude-3-7-sonnet')

    expect(flashResult.targetModel).toBe('gemini-3.7-flash')
    expect(proResult.targetModel).toBe('gemini-3.7-pro')
    expect(claudeResult.targetModel).toBe('claude-3-7-sonnet')

    // Pro and Claude should produce scaled higher token predictions
    expect(proResult.estimatedTokens.avg).toBeGreaterThanOrEqual(flashResult.estimatedTokens.avg)
    expect(claudeResult.estimatedTokens.avg).toBeGreaterThanOrEqual(flashResult.estimatedTokens.avg)

    // Status bar badge should reflect target model
    expect(flashResult.statusBarBadge).toContain('⚡')
    expect(proResult.statusBarBadge).toContain('[gemini-3.7-pro]')
    expect(claudeResult.statusBarBadge).toContain('[claude-3-7-sonnet]')
  })
})
