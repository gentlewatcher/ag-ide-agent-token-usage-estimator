/**
 * Antigravity IDE Status Bar Item Controller
 * Displays real-time pre-execution token/tool estimations, quota indicators, and rich hover tooltips
 */

import * as vscode from 'vscode'
import { estimateUsage } from '../estimation/estimator.js'
import { formatStatusBarBadge, formatStatusBarTooltip } from '../estimation/badge-formatter.js'
import { getSettings } from '../settings/storage.js'
import { fetchQuota } from '../quota/service.js'
import type { ExtensionConfig, StatusBarState } from './types.js'
import type { UsageEstimationResult } from '../estimation/types.js'
import type { QuotaSnapshot } from '../quota/types.js'

export class UsageStatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem
  private state: StatusBarState = { isEvaluating: false }
  private debounceTimer: NodeJS.Timeout | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private disposables: vscode.Disposable[] = []

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    )
    this.statusBarItem.name = 'AG Usage & Token Estimator'
    this.statusBarItem.text = '⚡ Estimating...'
    this.statusBarItem.tooltip = 'Antigravity Usage & Pre-Execution Estimator'
    this.statusBarItem.command = 'antigravityUsage.statusBarMenu'

    // Register active editor and document listeners
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.triggerDebouncedEvaluation()),
      vscode.workspace.onDidChangeTextDocument(() => this.triggerDebouncedEvaluation()),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('antigravityUsage')) {
          this.triggerDebouncedEvaluation(true)
          this.setupPollingTimer()
        }
      })
    )

    this.statusBarItem.show()
    this.setupPollingTimer()
    this.triggerDebouncedEvaluation(true)
  }

  /**
   * Get merged configuration from VS Code workspace settings and ~/.gemini settings.json
   */
  public getConfig(): ExtensionConfig {
    const vsConfig = vscode.workspace.getConfiguration('antigravityUsage')
    const diskSettings = getSettings()

    return {
      defaultModel: vsConfig.get('defaultModel') || diskSettings.defaultModel || 'gemini-3.7-flash',
      statusBarDisplayMode: vsConfig.get('statusBarDisplayMode') || diskSettings.statusBarDisplayMode || 'detailed',
      tokenWarningThreshold: vsConfig.get('tokenWarningThreshold') || diskSettings.tokenWarningThreshold || 100000,
      refreshInterval: vsConfig.get('refreshInterval', 60),
      showModelName: vsConfig.get('showModelName', true),
      showCountdown: vsConfig.get('showCountdown', true),
      autoSyncTranscripts: vsConfig.get('autoSyncTranscripts') || diskSettings.autoSyncTranscripts || true
    }
  }

  /**
   * Trigger debounced evaluation of active draft text / plan
   */
  public triggerDebouncedEvaluation(immediate = false): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (immediate) {
      this.evaluateAndUpdate().catch(err => console.error('[UsageStatusBar] Evaluation error:', err))
      return
    }

    this.debounceTimer = setTimeout(() => {
      this.evaluateAndUpdate().catch(err => console.error('[UsageStatusBar] Evaluation error:', err))
    }, 300)
  }

  /**
   * Evaluate active document / prompt and refresh status bar item
   */
  public async evaluateAndUpdate(): Promise<void> {
    if (this.state.isEvaluating) return
    this.state.isEvaluating = true

    try {
      const config = this.getConfig()
      const editor = vscode.window.activeTextEditor
      let evaluationInput = ''
      let sourceType: 'prompt' | 'plan' = 'prompt'
      let evaluatedPath: string | undefined

      if (editor && editor.document) {
        const doc = editor.document
        const text = doc.getText().trim()
        const fileName = doc.fileName.toLowerCase()

        if (fileName.endsWith('implementation_plan.md') || text.includes('# Implementation Plan') || text.includes('## Proposed Changes')) {
          sourceType = 'plan'
          evaluationInput = text
          evaluatedPath = doc.fileName
        } else if (text.length > 5) {
          sourceType = 'prompt'
          evaluationInput = text.slice(0, 4000)
          evaluatedPath = doc.fileName
        }
      }

      if (!evaluationInput) {
        const planFiles = await vscode.workspace.findFiles('**/implementation_plan.md', '**/node_modules/**', 1)
        if (planFiles.length > 0) {
          try {
            const doc = await vscode.workspace.openTextDocument(planFiles[0])
            evaluationInput = doc.getText()
            sourceType = 'plan'
            evaluatedPath = planFiles[0].fsPath
          } catch {
            // fallback
          }
        }
      }

      if (!evaluationInput) {
        evaluationInput = 'Antigravity workspace general tasks'
        sourceType = 'prompt'
      }

      const estimation = estimateUsage(evaluationInput, sourceType, config.defaultModel)
      this.state.lastEstimation = estimation
      this.state.lastEvaluatedPath = evaluatedPath
      this.state.lastEvaluatedType = sourceType

      let quotaSnapshot = this.state.lastQuotaSnapshot
      try {
        quotaSnapshot = await fetchQuota('auto')
        this.state.lastQuotaSnapshot = quotaSnapshot
      } catch {
        // preserve previous or skip
      }

      const badgeText = formatStatusBarBadge(estimation)

      let quotaTag = ''
      if (quotaSnapshot && quotaSnapshot.models.length > 0) {
        const primary = quotaSnapshot.models[0]
        if (primary.remainingPercentage !== undefined) {
          const pct = Math.round(primary.remainingPercentage)
          quotaTag = ` | $(dashboard) ${pct}%`
        }
      }

      this.statusBarItem.text = `${badgeText}${quotaTag}`

      if (estimation.estimatedTokens.avg >= config.tokenWarningThreshold) {
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
      } else {
        this.statusBarItem.backgroundColor = undefined
      }

      const markdown = this.buildRichMarkdownTooltip(estimation, quotaSnapshot)
      this.statusBarItem.tooltip = markdown
    } finally {
      this.state.isEvaluating = false
    }
  }

  /**
   * Build rich Markdown tooltip for status bar hover
   */
  private buildRichMarkdownTooltip(
    estimation: UsageEstimationResult,
    quota: QuotaSnapshot | undefined
  ): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true)
    md.isTrusted = true
    md.supportHtml = true

    md.appendMarkdown(formatStatusBarTooltip(estimation))

    if (quota && quota.models.length > 0) {
      md.appendMarkdown(`\n---\n\n### 🤖 Model Quotas\n\n`)
      for (const m of quota.models.slice(0, 3)) {
        if (m.remainingPercentage !== undefined) {
          const pct = Math.round(m.remainingPercentage)
          const bar = pct > 50 ? '🟢' : pct > 20 ? '🟡' : '🔴'
          const resetStr = m.resetTime ? ` (resets ${new Date(m.resetTime).toLocaleTimeString()})` : ''
          md.appendMarkdown(`${bar} **${m.label}**: ${pct}% remaining${resetStr}\n\n`)
        }
      }
    }

    md.appendMarkdown(`---\n\n[$(gear) Settings](command:antigravityUsage.openSettingsFile) &nbsp;|&nbsp; [$(globe) Dashboard](command:antigravityUsage.openSettingsWeb) &nbsp;|&nbsp; [$(sync) Refresh](command:antigravityUsage.refreshQuota) &nbsp;|&nbsp; [$(list-selection) Actions Menu](command:antigravityUsage.statusBarMenu)`)

    return md
  }

  /**
   * Set up background polling timer for model quota and sync
   */
  private setupPollingTimer(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    const config = this.getConfig()
    const intervalSec = config.refreshInterval || 60

    if (intervalSec > 0) {
      this.pollTimer = setInterval(() => {
        this.triggerDebouncedEvaluation(true)
      }, intervalSec * 1000)
    }
  }

  public getState(): StatusBarState {
    return this.state
  }

  public dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.statusBarItem.dispose()
    for (const d of this.disposables) d.dispose()
  }
}
