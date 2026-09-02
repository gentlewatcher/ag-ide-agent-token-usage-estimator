/**
 * Interactive QuickPick Action Menu for Antigravity IDE Status Bar
 */

import * as vscode from 'vscode'
import { openSettingsInEditor } from '../settings/storage.js'
import { startSettingsServer } from '../settings/server.js'
import { getModelRatios } from '../estimation/model-ratios.js'
import { syncHistoricalBrainArtifacts } from '../estimation/archive-store.js'
import { estimateUsage } from '../estimation/estimator.js'
import { wakeupCommand } from '../commands/wakeup.js'
import type { UsageStatusBarManager } from './statusBar.js'

interface QuickPickActionItem extends vscode.QuickPickItem {
  actionId: string
}

export async function showStatusBarQuickPick(statusBarManager: UsageStatusBarManager): Promise<void> {
  const state = statusBarManager.getState()
  const items: (QuickPickActionItem | vscode.QuickPickItem)[] = []

  // Current Estimation Summary Section
  if (state.lastEstimation) {
    const est = state.lastEstimation
    items.push({
      label: '🔮 Current Pre-Execution Estimation',
      kind: vscode.QuickPickItemKind.Separator
    })

    items.push({
      label: `$(sparkle) Predicted: ~${est.estimatedTokens.avg.toLocaleString()} Tokens (${Math.round(est.estimatedTokens.confidence * 100)}% Conf)`,
      description: `Target: ${est.targetModel} (${est.modelRatioMultiplier.toFixed(2)}x scaling)`,
      detail: `Tool calls: ~${est.estimatedToolCalls.avg} | Steps: ~${est.estimatedSteps}`,
      actionId: 'estimate-details'
    })
  }

  // Action Menu Items Section
  items.push({
    label: '⚡ Quick Actions & Tools',
    kind: vscode.QuickPickItemKind.Separator
  })

  items.push(
    {
      label: '$(edit) Estimate Draft Prompt',
      description: 'Input a custom prompt to predict token & tool costs',
      actionId: 'estimate-prompt'
    },
    {
      label: '$(graph) View Cross-Model Statistical Ratio Matrix',
      description: 'Inspect empirical token scaling factors between models',
      actionId: 'model-ratios'
    },
    {
      label: '$(organization) Open Agent Token Analytics',
      description: 'View historical token consumption across conversation sessions',
      actionId: 'agent-analytics'
    },
    {
      label: '$(file-code) Open Settings File in Editor Tab',
      description: 'Edit settings.json directly with JSON Schema autocomplete',
      actionId: 'open-settings-editor'
    },
    {
      label: '$(globe) Open Web Settings Dashboard',
      description: 'Launch interactive glassmorphic dashboard in browser',
      actionId: 'open-settings-web'
    },
    {
      label: '$(sync) Sync Brain Artifacts & Recalibrate',
      description: 'Index local plans and update empirical ratio matrix',
      actionId: 'sync-brain'
    },
    {
      label: '$(clock) Trigger Model Wakeup / Warmup',
      description: 'Execute model wake-up cycle to preserve daily quota',
      actionId: 'wakeup-trigger'
    },
    {
      label: '$(refresh) Refresh Model Quotas Now',
      description: 'Query Cloud Code API for live remaining percentages',
      actionId: 'refresh-quota'
    }
  )

  const selected = await vscode.window.showQuickPick(items as QuickPickActionItem[], {
    placeHolder: '⚡ Antigravity Usage & Pre-Execution Estimator',
    matchOnDescription: true,
    matchOnDetail: true
  })

  if (!selected || !('actionId' in selected)) return

  switch (selected.actionId) {
    case 'open-settings-editor': {
      const path = await openSettingsInEditor()
      const doc = await vscode.workspace.openTextDocument(path)
      await vscode.window.showTextDocument(doc)
      break
    }
    case 'open-settings-web': {
      await startSettingsServer({ openBrowser: true })
      vscode.window.showInformationMessage('🌐 Antigravity Usage Settings Dashboard launched in browser!')
      break
    }
    case 'estimate-prompt': {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Enter prompt to estimate token and tool costs:',
        placeHolder: 'e.g. Build a Bevy game engine ECS visualizer'
      })
      if (prompt) {
        const est = estimateUsage(prompt, 'prompt')
        vscode.window.showInformationMessage(`Predicted: ~${est.estimatedTokens.avg.toLocaleString()} tokens | ~${est.estimatedToolCalls.avg} tools (${Math.round(est.estimatedTokens.confidence * 100)}% conf)`)
      }
      break
    }
    case 'model-ratios': {
      const ratios = getModelRatios()
      const ratioItems = Object.values(ratios.models).map(m => ({
        label: `${m.displayName || m.modelId}: ${m.totalRatio.toFixed(2)}x scaling`,
        description: `Prompt: ${m.promptRatio.toFixed(2)}x | Completion: ${m.completionRatio.toFixed(2)}x | Samples: ${m.sampleCount}`
      }))
      await vscode.window.showQuickPick(ratioItems, {
        placeHolder: `Cross-Model Ratio Matrix (Baseline: ${ratios.baselineModel})`
      })
      break
    }
    case 'sync-brain': {
      const records = syncHistoricalBrainArtifacts()
      await statusBarManager.evaluateAndUpdate()
      vscode.window.showInformationMessage(`🔄 Successfully synced ${records.length} historical conversation traces!`)
      break
    }
    case 'wakeup-trigger': {
      vscode.window.showInformationMessage('⏰ Triggering AI model wakeup cycle...')
      await wakeupCommand('trigger', [], {})
      vscode.window.showInformationMessage('✅ AI Model quota trigger completed!')
      break
    }
    case 'refresh-quota': {
      await statusBarManager.evaluateAndUpdate()
      vscode.window.showInformationMessage('🔄 Antigravity model quotas and estimations refreshed!')
      break
    }
  }
}
