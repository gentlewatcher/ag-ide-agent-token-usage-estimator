import { describe, it, expect } from 'vitest'
import { extractKeywords, extractPlannedFiles } from '../../src/estimation/archive-store.js'

describe('Archive Store Extraction', () => {
  it('extracts technical keywords and filters stop words', () => {
    const text = 'Please help port the OAuth tokens and schedule tasks with PowerShell on Windows'
    const keywords = extractKeywords(text)

    expect(keywords).toContain('port')
    expect(keywords).toContain('oauth')
    expect(keywords).toContain('tokens')
    expect(keywords).toContain('schedule')
    expect(keywords).toContain('tasks')
    expect(keywords).toContain('powershell')
    expect(keywords).toContain('windows')
    expect(keywords).not.toContain('please')
    expect(keywords).not.toContain('the')
    expect(keywords).not.toContain('and')
    expect(keywords).not.toContain('with')
  })

  it('extracts planned files from markdown', () => {
    const planMd = `
# Implementation Plan

#### [NEW] [types.ts](file:///c:/path/to/src/estimation/types.ts)
#### [MODIFY] [index.ts](file:///c:/path/to/src/index.ts)
#### [DELETE] [legacy.ts](file:///c:/path/to/src/legacy.ts)
`
    const files = extractPlannedFiles(planMd)
    expect(files.length).toBe(3)
    expect(files[0]).toEqual({
      actionType: 'NEW',
      filePath: 'c:/path/to/src/estimation/types.ts',
      basename: 'types.ts'
    })
    expect(files[1]).toEqual({
      actionType: 'MODIFY',
      filePath: 'c:/path/to/src/index.ts',
      basename: 'index.ts'
    })
    expect(files[2]).toEqual({
      actionType: 'DELETE',
      filePath: 'c:/path/to/src/legacy.ts',
      basename: 'legacy.ts'
    })
  })
})
