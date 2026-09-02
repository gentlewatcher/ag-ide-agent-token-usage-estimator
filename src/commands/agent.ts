/**
 * Agent command - track and inspect Antigravity agent usage and token metrics
 */

import { getAgentOverallStats, getAgentSessions } from '../agent/service.js'
import { 
  printAgentSummary, 
  printAgentSessionsTable, 
  printAgentSessionDetail, 
  printAgentJson 
} from '../agent/format.js'
import { error as logError, info } from '../core/logger.js'
import type { AgentUsageFilterOptions } from '../agent/types.js'

interface AgentCommandOptions {
  json?: boolean
  limit?: string
  since?: string
  session?: string
  detailed?: boolean
}

export async function agentCommand(action?: string, targetId?: string, options: AgentCommandOptions = {}): Promise<void> {
  const filterOptions: AgentUsageFilterOptions = {
    json: options.json,
    since: options.since,
    limit: options.limit ? parseInt(options.limit, 10) : 20,
    conversationId: targetId || options.session
  }

  try {
    if (action === 'session' || targetId || options.session) {
      const sessions = getAgentSessions({
        conversationId: targetId || options.session,
        limit: 1
      })

      if (sessions.length === 0) {
        logError(`No agent conversation found matching ID: ${targetId || options.session}`)
        process.exit(1)
      }

      if (options.json) {
        printAgentJson(sessions[0])
      } else {
        printAgentSessionDetail(sessions[0])
      }
      return
    }

    if (action === 'sessions') {
      const sessions = getAgentSessions(filterOptions)
      if (options.json) {
        printAgentJson(sessions)
      } else {
        console.log(`\n💬 \x1b[1mAntigravity Agent Conversations (${sessions.length})\x1b[0m\n`)
        printAgentSessionsTable(sessions)
        console.log('')
      }
      return
    }

    if (action === 'models') {
      const stats = getAgentOverallStats(filterOptions)
      if (options.json) {
        printAgentJson(stats.modelUsage)
      } else {
        console.log('\n📊 \x1b[1mAgent Model Usage Distribution\x1b[0m\n')
        printAgentSummary(stats)
      }
      return
    }

    // Default: Overall summary
    const stats = getAgentOverallStats(filterOptions)
    if (options.json) {
      printAgentJson(stats)
    } else {
      printAgentSummary(stats)
    }
  } catch (err) {
    logError(`Failed to retrieve agent usage: ${err instanceof Error ? err.message : 'Unknown error'}`)
    process.exit(1)
  }
}
