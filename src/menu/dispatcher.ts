/**
 * Bottom Bar Right-Click / Context Menu and QuickPick Command Dispatcher
 */

import inquirer from 'inquirer'
import { openSettingsInEditor } from '../settings/storage.js'
import { startSettingsServer } from '../settings/server.js'
import { estimateCommand } from '../commands/estimate.js'
import { agentCommand } from '../commands/agent.js'
import { doctorCommand } from '../commands/doctor.js'
import { wakeupCommand } from '../commands/wakeup.js'
import { accountsCommand } from '../commands/accounts.js'
import { info } from '../core/logger.js'

export interface MenuItemDefinition {
  id: string
  label: string
  description: string
  command: string
  category?: string
}

export const STATUS_BAR_MENU_ITEMS: MenuItemDefinition[] = [
  {
    id: 'estimate-plan',
    label: '⚡ Estimate Proposed Implementation Plan',
    description: 'Predict token usage and tool executions before approving plan',
    command: 'antigravity-usage.estimatePlan',
    category: 'Estimation'
  },
  {
    id: 'estimate-prompt',
    label: '💬 Estimate Draft Prompt',
    description: 'Predict token cost for a prompt before sending',
    command: 'antigravity-usage.estimatePrompt',
    category: 'Estimation'
  },
  {
    id: 'model-ratios',
    label: '📊 View Cross-Model Ratio Matrix',
    description: 'Inspect empirical model token scaling factors',
    command: 'antigravity-usage.showRatios',
    category: 'Analytics'
  },
  {
    id: 'agent-analytics',
    label: '🤖 Open Agent Token Analytics',
    description: 'Detailed conversation token consumption & tool breakdowns',
    command: 'antigravity-usage.agentSummary',
    category: 'Analytics'
  },
  {
    id: 'sync-brain',
    label: '🔄 Sync Brain Traces & Recalibrate',
    description: 'Index local plans and update empirical ratio matrix',
    command: 'antigravity-usage.syncBrain',
    category: 'Maintenance'
  },
  {
    id: 'open-settings-editor',
    label: '📄 Open Settings in Editor Tab',
    description: 'Edit settings.json directly with JSON Schema autocomplete',
    command: 'antigravity-usage.openSettingsFile',
    category: 'Configuration'
  },
  {
    id: 'open-settings-web',
    label: '🌐 Open Web Settings Dashboard',
    description: 'Launch visual settings UI in browser or webview',
    command: 'antigravity-usage.openSettingsWeb',
    category: 'Configuration'
  },
  {
    id: 'wakeup-trigger',
    label: '⏰ Trigger Model Wakeup / Warmup',
    description: 'Execute model wake-up cycle to preserve daily quota',
    command: 'antigravity-usage.triggerWakeup',
    category: 'Actions'
  },
  {
    id: 'accounts-switch',
    label: '👥 Switch Active Google Account',
    description: 'Manage and switch active Google Cloud account',
    command: 'antigravity-usage.accounts',
    category: 'Authentication'
  },
  {
    id: 'doctor-diagnostics',
    label: '🩺 Run System Diagnostics',
    description: 'Verify native credentials, brain paths, and local runtime',
    command: 'antigravity-usage.doctor',
    category: 'Diagnostics'
  }
]

/**
 * Get context menu schema definition for IDE status bar integration
 */
export function getStatusBarContextMenuDefinitions(): MenuItemDefinition[] {
  return STATUS_BAR_MENU_ITEMS
}

/**
 * Dispatch and execute a menu action by ID
 */
export async function executeMenuItem(actionId: string): Promise<void> {
  switch (actionId) {
    case 'open-settings-editor':
      await openSettingsInEditor()
      break
    case 'open-settings-web':
      await startSettingsServer({ openBrowser: true })
      break
    case 'estimate-plan':
      await estimateCommand({})
      break
    case 'estimate-prompt': {
      const { prompt } = await inquirer.prompt([
        {
          type: 'input',
          name: 'prompt',
          message: 'Enter prompt to estimate:'
        }
      ])
      await estimateCommand({ prompt })
      break
    }
    case 'model-ratios':
      await estimateCommand({ ratios: true })
      break
    case 'agent-analytics':
      await agentCommand('summary')
      break
    case 'sync-brain':
      await estimateCommand({ sync: true })
      break
    case 'wakeup-trigger':
      await wakeupCommand('trigger', [], {})
      break
    case 'accounts-switch':
      await accountsCommand('list', [], {})
      break
    case 'doctor-diagnostics':
      await doctorCommand()
      break
    default:
      info(`Action ${actionId} not recognized`)
  }
}

/**
 * Run interactive QuickPick menu in terminal
 */
export async function runInteractiveMenu(options: { json?: boolean } = {}): Promise<void> {
  if (options.json) {
    console.log(JSON.stringify(getStatusBarContextMenuDefinitions(), null, 2))
    return
  }

  console.log('\n🎯 \x1b[1mAntigravity Usage - Bottom Bar Quick Actions\x1b[0m\n')

  const choices = STATUS_BAR_MENU_ITEMS.map(item => ({
    name: `${item.label} \x1b[90m— ${item.description}\x1b[0m`,
    value: item.id
  }))

  const { selectedAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedAction',
      message: 'Select action to execute:',
      choices,
      pageSize: 12
    }
  ])

  await executeMenuItem(selectedAction)
}
