import { describe, it, expect } from 'vitest'
import { findSimilarRecords, estimateUsage } from '../../src/estimation/estimator.js'
import type { ArchivedActionRecord } from '../../src/estimation/types.js'

describe('Similarity Matching and Estimator', () => {
  const sampleRecords: ArchivedActionRecord[] = [
    {
      id: 'rec-1',
      conversationId: 'conv-1',
      timestamp: '2026-09-02T10:00:00.000Z',
      title: 'OAuth tokens port to antigravity',
      promptText: 'git pull repo and port oauth authentication credentials to antigravity',
      plannedFiles: [
        { actionType: 'MODIFY', filePath: 'src/google/storage.ts', basename: 'storage.ts' },
        { actionType: 'MODIFY', filePath: 'src/google/oauth.ts', basename: 'oauth.ts' }
      ],
      executedTools: ['view_file', 'replace_file_content', 'run_command'],
      toolCallCounts: {
        view_file: 4,
        replace_file_content: 3,
        run_command: 2
      },
      promptTokens: 15000,
      completionTokens: 5000,
      totalTokens: 20000,
      stepCount: 8,
      modelsUsed: ['gemini-3.7-flash'],
      keywords: ['git', 'pull', 'repo', 'port', 'oauth', 'authentication', 'tokens', 'credentials', 'antigravity', 'storage.ts', 'oauth.ts']
    },
    {
      id: 'rec-2',
      conversationId: 'conv-2',
      timestamp: '2026-09-01T10:00:00.000Z',
      title: 'Rust spreadsheet calculation engine',
      promptText: 'build a rust spreadsheet engine with bevy ecs and webassembly',
      plannedFiles: [
        { actionType: 'NEW', filePath: 'src/engine.rs', basename: 'engine.rs' }
      ],
      executedTools: ['write_to_file', 'run_command'],
      toolCallCounts: {
        write_to_file: 6,
        run_command: 5
      },
      promptTokens: 80000,
      completionTokens: 30000,
      totalTokens: 110000,
      stepCount: 25,
      modelsUsed: ['gemini-3.7-pro'],
      keywords: ['build', 'rust', 'spreadsheet', 'engine', 'bevy', 'ecs', 'webassembly', 'engine.rs']
    }
  ]

  it('matches similar records based on keywords and planned files', () => {
    const input = 'port OAuth authentication and tokens storage'
    const matches = findSimilarRecords(input, sampleRecords)

    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].record.id).toBe('rec-1')
    expect(matches[0].matchedKeywords).toContain('oauth')
    expect(matches[0].matchedKeywords).toContain('tokens')
    expect(matches[0].similarityScore).toBeGreaterThan(0.2)
  })

  it('computes usage estimates with confidence and status bar badge', () => {
    const result = estimateUsage('port OAuth authentication tokens', 'prompt')

    expect(result).toHaveProperty('estimatedTokens')
    expect(result.estimatedTokens.avg).toBeGreaterThan(0)
    expect(result.estimatedTokens.min).toBeLessThanOrEqual(result.estimatedTokens.avg)
    expect(result.estimatedTokens.max).toBeGreaterThanOrEqual(result.estimatedTokens.avg)
    expect(result.statusBarBadge).toContain('⚡')
    expect(result.statusBarBadge).toContain('tok')
    expect(result.statusBarTooltip).toContain('Antigravity Pre-Execution Usage Estimation')
  })
})
