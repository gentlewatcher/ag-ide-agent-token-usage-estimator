/**
 * Archive store for historical implementation plan artifacts and action execution traces
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { getAntigravityBrainDirs, getGeminiHomeDir } from '../core/env.js'
import { parseTranscript } from '../agent/transcript-parser.js'
import { debug } from '../core/logger.js'
import { recomputeModelRatios } from './model-ratios.js'
import type { ArchivedActionRecord, ArchivedPlanFile, ModelTokenStats } from './types.js'

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t',
  'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t',
  'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
  'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s',
  'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
  'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s',
  'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re',
  'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'please', 'help', 'want', 'need', 'make', 'create', 'update'
])

/**
 * Extract meaningful technical keywords from text
 */
export function extractKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') return []

  const words = text
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))

  return Array.from(new Set(words))
}

/**
 * Extract planned file changes from implementation_plan.md markdown
 */
export function extractPlannedFiles(planMarkdown?: string): ArchivedPlanFile[] {
  if (!planMarkdown) return []

  const files: ArchivedPlanFile[] = []
  const lines = planMarkdown.split('\n')

  // Patterns like #### [NEW] [file basename](file:///path) or #### [MODIFY] [file](path)
  const pattern = /####\s+\[(NEW|MODIFY|DELETE|VIEW)\]\s+\[([^\]]+)\]\(([^)]+)\)/i

  for (const line of lines) {
    const match = line.match(pattern)
    if (match) {
      const actionType = match[1].toUpperCase() as 'NEW' | 'MODIFY' | 'DELETE' | 'VIEW'
      const name = match[2]
      const rawPath = match[3].replace(/^file:\/\/\/?/, '')

      files.push({
        actionType,
        filePath: rawPath,
        basename: name || basename(rawPath)
      })
    }
  }

  return files
}

/**
 * Get path to the persistent action archive directory and index file
 */
export function getArchiveStoragePaths(): { archiveDir: string; indexPath: string } {
  const archiveDir = join(getGeminiHomeDir(), 'antigravity-usage', 'action_archive')
  const indexPath = join(archiveDir, 'archive_index.json')
  return { archiveDir, indexPath }
}

/**
 * Load archived action records from disk
 */
export function getArchivedRecords(): ArchivedActionRecord[] {
  const { indexPath } = getArchiveStoragePaths()

  if (existsSync(indexPath)) {
    try {
      const content = readFileSync(indexPath, 'utf-8')
      return JSON.parse(content) as ArchivedActionRecord[]
    } catch (err) {
      debug('archive-store', 'Failed to parse archive index', err)
    }
  }

  // If no archive exists yet, sync from local brain folders
  return syncHistoricalBrainArtifacts()
}

/**
 * Save archived action records to disk
 */
export function saveArchivedRecords(records: ArchivedActionRecord[]): void {
  const { archiveDir, indexPath } = getArchiveStoragePaths()

  try {
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true })
    }
    writeFileSync(indexPath, JSON.stringify(records, null, 2), 'utf-8')
    debug('archive-store', `Saved ${records.length} action records to archive index`)
  } catch (err) {
    debug('archive-store', 'Failed to save archive index', err)
  }
}

/**
 * Sync and index all local Antigravity brain implementation plans and transcript action logs
 */
export function syncHistoricalBrainArtifacts(): ArchivedActionRecord[] {
  const brainDirs = getAntigravityBrainDirs()
  const recordsMap: Map<string, ArchivedActionRecord> = new Map()

  // Load existing records first to preserve them
  const { indexPath } = getArchiveStoragePaths()
  if (existsSync(indexPath)) {
    try {
      const existing = JSON.parse(readFileSync(indexPath, 'utf-8')) as ArchivedActionRecord[]
      for (const r of existing) {
        recordsMap.set(r.conversationId, r)
      }
    } catch (e) {
      debug('archive-store', 'Could not read existing archive index for merging', e)
    }
  }

  for (const brainDir of brainDirs) {
    if (!existsSync(brainDir)) continue

    try {
      const entries = readdirSync(brainDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const conversationId = entry.name
        const convDir = join(brainDir, conversationId)

        const planPath = join(convDir, 'implementation_plan.md')
        const walkthroughPath = join(convDir, 'walkthrough.md')
        const logsDir = join(convDir, '.system_generated', 'logs')
        const transcriptPath = join(logsDir, 'transcript.jsonl')
        const transcriptFullPath = join(logsDir, 'transcript_full.jsonl')

        const actualTranscript = existsSync(transcriptPath)
          ? transcriptPath
          : existsSync(transcriptFullPath)
          ? transcriptFullPath
          : null

        if (!actualTranscript) continue

        const session = parseTranscript(conversationId, actualTranscript)
        if (!session) continue

        let planMarkdown: string | undefined
        if (existsSync(planPath)) {
          try {
            planMarkdown = readFileSync(planPath, 'utf-8')
          } catch {}
        }

        let walkthroughMarkdown: string | undefined
        if (existsSync(walkthroughPath)) {
          try {
            walkthroughMarkdown = readFileSync(walkthroughPath, 'utf-8')
          } catch {}
        }

        const plannedFiles = extractPlannedFiles(planMarkdown)
        const executedTools = Object.keys(session.toolCallsBreakdown)
        const modelsUsed = Object.keys(session.modelBreakdown)
        const allKeywords = extractKeywords(`${session.title || ''} ${planMarkdown || ''} ${executedTools.join(' ')}`)

        // Determine primary model (model with largest totalTokens)
        let primaryModel = 'gemini-3.7-flash'
        let maxModelTokens = -1
        const modelTokenBreakdown: Record<string, ModelTokenStats> = {}

        for (const [mName, stats] of Object.entries(session.modelBreakdown)) {
          modelTokenBreakdown[mName] = {
            promptTokens: stats.promptTokens,
            completionTokens: stats.completionTokens,
            totalTokens: stats.totalTokens,
            stepCount: stats.turns
          }
          if (stats.totalTokens > maxModelTokens) {
            maxModelTokens = stats.totalTokens
            primaryModel = mName
          }
        }

        const record: ArchivedActionRecord = {
          id: conversationId,
          conversationId,
          timestamp: session.lastActiveTime || new Date().toISOString(),
          title: session.title,
          promptText: session.title || '',
          planMarkdown,
          walkthroughMarkdown,
          plannedFiles,
          executedTools,
          toolCallCounts: session.toolCallsBreakdown,
          promptTokens: session.totalPromptTokens,
          completionTokens: session.totalCompletionTokens,
          totalTokens: session.totalTokens,
          stepCount: session.stepCount,
          primaryModel,
          modelsUsed,
          modelTokenBreakdown,
          keywords: allKeywords
        }

        recordsMap.set(conversationId, record)
      }
    } catch (err) {
      debug('archive-store', `Error scanning brain directory ${brainDir}`, err)
    }
  }

  const records = Array.from(recordsMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  saveArchivedRecords(records)
  recomputeModelRatios(records)
  return records
}
