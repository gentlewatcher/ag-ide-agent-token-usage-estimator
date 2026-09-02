import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseTranscript } from '../../src/agent/transcript-parser.js'

describe('Transcript Parser', () => {
  const testDir = join(tmpdir(), 'antigravity-transcript-test-' + Date.now())
  const sampleLogFile = join(testDir, 'transcript.jsonl')

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('correctly parses agent steps, tokens, tools and model breakdown', () => {
    const lines = [
      JSON.stringify({
        step_index: 0,
        type: 'USER_INPUT',
        source: 'USER_EXPLICIT',
        content: 'Please help write a TypeScript port',
        timestamp: '2026-09-02T14:00:00.000Z'
      }),
      JSON.stringify({
        step_index: 1,
        type: 'PLANNER_RESPONSE',
        source: 'MODEL',
        model: 'gemini-3.7-flash',
        content: 'I will analyze the repository and plan the implementation.',
        usageMetadata: {
          promptTokenCount: 150,
          candidatesTokenCount: 50,
          totalTokenCount: 200
        },
        tool_calls: [
          { name: 'list_dir', args: { DirectoryPath: '.' } }
        ],
        timestamp: '2026-09-02T14:00:05.000Z'
      }),
      JSON.stringify({
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        source: 'MODEL',
        model: 'gemini-3.7-pro',
        content: 'Editing the files now.',
        usageMetadata: {
          promptTokenCount: 300,
          candidatesTokenCount: 120,
          totalTokenCount: 420
        },
        tool_calls: [
          { name: 'replace_file_content', args: {} },
          { name: 'write_to_file', args: {} }
        ],
        timestamp: '2026-09-02T14:00:15.000Z'
      })
    ]

    writeFileSync(sampleLogFile, lines.join('\n'))

    const session = parseTranscript('test-conv-123', sampleLogFile)

    expect(session).not.toBeNull()
    expect(session?.conversationId).toBe('test-conv-123')
    expect(session?.title).toContain('Please help write a TypeScript port')
    expect(session?.stepCount).toBe(3)
    expect(session?.totalPromptTokens).toBe(450)
    expect(session?.totalCompletionTokens).toBe(170)
    expect(session?.totalTokens).toBe(620)
    expect(session?.toolCallsBreakdown['list_dir']).toBe(1)
    expect(session?.toolCallsBreakdown['replace_file_content']).toBe(1)
    expect(session?.toolCallsBreakdown['write_to_file']).toBe(1)
    expect(session?.modelBreakdown['gemini-3.7-flash']?.totalTokens).toBe(200)
    expect(session?.modelBreakdown['gemini-3.7-pro']?.totalTokens).toBe(420)
  })
})
