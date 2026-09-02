import { describe, it, expect } from 'vitest'
import { 
  getModelPrior, 
  recomputeModelRatios, 
  scaleTokensBetweenModels, 
  BASELINE_MODEL 
} from '../../src/estimation/model-ratios.js'
import type { ArchivedActionRecord } from '../../src/estimation/types.js'

describe('Model Ratio Matrix and Bayesian Smoothing', () => {
  it('resolves correct priors for known and pattern-based model IDs', () => {
    const flashPrior = getModelPrior('gemini-3.7-flash')
    expect(flashPrior.total).toBe(1.0)

    const proPrior = getModelPrior('gemini-3.7-pro')
    expect(proPrior.total).toBeGreaterThan(1.3)

    const sonnetPrior = getModelPrior('claude-3-7-sonnet')
    expect(sonnetPrior.total).toBeGreaterThan(1.5)

    const customReasoning = getModelPrior('my-custom-thinking-model')
    expect(customReasoning.total).toBeGreaterThan(1.5)

    const customMini = getModelPrior('local-mini-v1')
    expect(customMini.total).toBeLessThan(1.0)
  })

  it('recomputes empirical ratios with Bayesian smoothing from records', () => {
    const sampleRecords: ArchivedActionRecord[] = [
      {
        id: 'rec-flash-1',
        conversationId: 'c1',
        timestamp: '2026-09-02T10:00:00Z',
        promptText: 'Task on flash',
        plannedFiles: [],
        executedTools: ['run_command'],
        toolCallCounts: { run_command: 2 },
        promptTokens: 10000,
        completionTokens: 2000,
        totalTokens: 12000,
        stepCount: 4,
        primaryModel: 'gemini-3.7-flash',
        modelsUsed: ['gemini-3.7-flash'],
        keywords: ['task', 'flash']
      },
      {
        id: 'rec-pro-1',
        conversationId: 'c2',
        timestamp: '2026-09-02T11:00:00Z',
        promptText: 'Task on pro',
        plannedFiles: [],
        executedTools: ['run_command'],
        toolCallCounts: { run_command: 2 },
        promptTokens: 12000,
        completionTokens: 6000,
        totalTokens: 18000,
        stepCount: 4,
        primaryModel: 'gemini-3.7-pro',
        modelsUsed: ['gemini-3.7-pro'],
        keywords: ['task', 'pro']
      }
    ]

    const matrix = recomputeModelRatios(sampleRecords)

    expect(matrix.baselineModel).toBe(BASELINE_MODEL)
    expect(matrix.totalSamples).toBe(2)
    expect(matrix.models['gemini-3.7-flash']).toBeDefined()
    expect(matrix.models['gemini-3.7-pro']).toBeDefined()
    expect(matrix.models['gemini-3.7-pro'].totalRatio).toBeGreaterThan(1.0)
    expect(matrix.models['gemini-3.7-pro'].completionRatio).toBeGreaterThan(1.2)
  })

  it('scales tokens between different models using ratio matrix', () => {
    const { scaledTokens, multiplier } = scaleTokensBetweenModels(10000, 'gemini-3.7-flash', 'gemini-3.7-pro')

    expect(multiplier).toBeGreaterThan(1.2)
    expect(scaledTokens).toBe(Math.round(10000 * multiplier))

    const reverse = scaleTokensBetweenModels(10000, 'gemini-3.7-pro', 'gemini-3.7-flash')
    expect(reverse.multiplier).toBeLessThan(1.0)
    expect(reverse.scaledTokens).toBeLessThan(10000)
  })
})
