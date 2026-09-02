/**
 * Estimate command - pre-execution token usage and tool call estimation
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { syncHistoricalBrainArtifacts, getArchivedRecords } from '../estimation/archive-store.js'
import { estimateUsage } from '../estimation/estimator.js'
import { getModelRatios, BASELINE_MODEL } from '../estimation/model-ratios.js'
import { printEstimationReport, printModelRatiosTable } from '../estimation/badge-formatter.js'
import { error as logError, info } from '../core/logger.js'
import type { EstimateOptions, StatusBarBadgePayload } from '../estimation/types.js'

export async function estimateCommand(options: EstimateOptions = {}): Promise<void> {
  try {
    if (options.ratios) {
      const matrix = getModelRatios()
      if (options.json) {
        console.log(JSON.stringify(matrix, null, 2))
      } else {
        printModelRatiosTable(matrix)
      }
      return
    }

    if (options.sync) {
      info('🔄 Syncing historical brain artifacts and action traces...')
      const records = syncHistoricalBrainArtifacts()
      console.log(`✅ Successfully archived and indexed \x1b[1m${records.length}\x1b[0m historical conversation traces.\n`)
      return
    }

    let inputContent = options.prompt || ''
    let sourceType: 'prompt' | 'plan' = 'prompt'

    if (options.planPath) {
      if (!existsSync(options.planPath)) {
        logError(`Plan file not found: ${options.planPath}`)
        process.exit(1)
      }
      inputContent = readFileSync(options.planPath, 'utf-8')
      sourceType = 'plan'
    } else if (!inputContent) {
      // Check if an implementation_plan.md exists in current working directory
      const localPlanPath = join(process.cwd(), 'implementation_plan.md')
      if (existsSync(localPlanPath)) {
        inputContent = readFileSync(localPlanPath, 'utf-8')
        sourceType = 'plan'
      } else {
        // Fallback: Check active brain directory implementation plan
        const records = getArchivedRecords()
        if (records.length > 0 && records[0].planMarkdown) {
          inputContent = records[0].planMarkdown
          sourceType = 'plan'
        } else {
          logError('Please provide a prompt with --prompt "<text>" or plan path with --plan <file>')
          process.exit(1)
        }
      }
    }

    const targetModel = options.model || BASELINE_MODEL
    const result = estimateUsage(inputContent, sourceType, targetModel)

    if (options.badge) {
      console.log(result.statusBarBadge)
      return
    }

    if (options.json) {
      const payload: StatusBarBadgePayload = {
        text: result.statusBarBadge,
        tooltip: result.statusBarTooltip,
        command: 'antigravity-usage.showEstimation',
        severity: result.estimatedTokens.avg > 100000 ? 'warning' : 'normal',
        targetModel: result.targetModel,
        estimatedTokens: result.estimatedTokens.avg,
        estimatedTools: result.estimatedToolCalls.avg,
        confidence: result.estimatedTokens.confidence
      }
      console.log(JSON.stringify(payload, null, 2))
      return
    }

    printEstimationReport(result)
  } catch (err) {
    logError(`Failed to estimate usage: ${err instanceof Error ? err.message : 'Unknown error'}`)
    process.exit(1)
  }
}
