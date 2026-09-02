/**
 * Antigravity IDE Extension Entrypoint
 */

import * as vscode from 'vscode'
import { UsageStatusBarManager } from './extension/statusBar.js'
import { showStatusBarQuickPick } from './extension/quickPick.js'
import { openSettingsInEditor } from './settings/storage.js'
import { startSettingsServer } from './settings/server.js'
import { wakeupCommand } from './commands/wakeup.js'

let statusBarManager: UsageStatusBarManager | null = null

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[Antigravity Usage Extension] Activating Pre-Execution Usage Estimator & Quota Extension...')

  statusBarManager = new UsageStatusBarManager()
  context.subscriptions.push(statusBarManager)

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityUsage.statusBarMenu', async () => {
      if (statusBarManager) {
        await showStatusBarQuickPick(statusBarManager)
      }
    }),

    vscode.commands.registerCommand('antigravityUsage.refreshQuota', async () => {
      if (statusBarManager) {
        await statusBarManager.evaluateAndUpdate()
        vscode.window.showInformationMessage('🔄 Antigravity model quotas and estimations refreshed!')
      }
    }),

    vscode.commands.registerCommand('antigravityUsage.openSettingsFile', async () => {
      const path = await openSettingsInEditor()
      const doc = await vscode.workspace.openTextDocument(path)
      await vscode.window.showTextDocument(doc)
    }),

    vscode.commands.registerCommand('antigravityUsage.openSettingsWeb', async () => {
      await startSettingsServer({ openBrowser: true })
      vscode.window.showInformationMessage('🌐 Settings Dashboard running at http://localhost:3840')
    }),

    vscode.commands.registerCommand('antigravityUsage.triggerWakeup', async () => {
      vscode.window.showInformationMessage('⏰ Triggering AI model wakeup cycle...')
      await wakeupCommand('trigger', [], {})
      vscode.window.showInformationMessage('✅ AI Model quota trigger completed!')
    })
  )
}

export function deactivate(): void {
  if (statusBarManager) {
    statusBarManager.dispose()
    statusBarManager = null
  }
}
