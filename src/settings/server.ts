/**
 * Lightweight local HTTP server hosting the glassmorphic Settings Web Dashboard and REST API
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { openUrl as open } from '../utils/open-url.js'
import { getSettings, updateSettings, openSettingsInEditor } from './storage.js'
import { getModelRatios } from '../estimation/model-ratios.js'
import { estimateUsage } from '../estimation/estimator.js'
import { syncHistoricalBrainArtifacts, getArchivedRecords } from '../estimation/archive-store.js'
import { debug, info } from '../core/logger.js'
import type { AppSettings } from './types.js'

function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1e6) {
        req.destroy()
        reject(new Error('Body too large'))
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end(JSON.stringify(data))
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}

/**
 * Generate modern glassmorphic dashboard HTML/CSS/JS single-page application
 */
export function getSettingsDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antigravity Usage Settings</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 20%, rgb(17, 24, 39) 0%, rgb(10, 14, 23) 90%);
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent-primary: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.25);
      --accent-success: #34d399;
      --accent-warning: #fbbf24;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-family);
      background: var(--bg-gradient);
      color: var(--text-main);
      min-height: 100vh;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
    }

    .container {
      width: 100%;
      max-width: 960px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-logo {
      font-size: 32px;
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .header-sub {
      font-size: 14px;
      color: var(--text-muted);
    }

    .btn-group {
      display: flex;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 16px;
      border-radius: 8px;
      font-family: var(--font-family);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid var(--card-border);
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
    }

    .btn:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-1px);
    }

    .btn-primary {
      background: linear-gradient(135deg, #38bdf8, #2563eb);
      border: none;
      box-shadow: 0 4px 14px var(--accent-glow);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #60a5fa, #1d4ed8);
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .card-title {
      font-size: 17px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #e2e8f0;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    select, input[type="text"], input[type="number"], textarea {
      width: 100%;
      padding: 11px 14px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      color: var(--text-main);
      font-family: var(--font-family);
      font-size: 14px;
      outline: none;
      transition: border 0.2s ease;
    }

    select:focus, input:focus, textarea:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }

    .toggle-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .toggle-group:last-child {
      border-bottom: none;
    }

    .toggle-info h4 {
      font-size: 14px;
      font-weight: 600;
    }

    .toggle-info p {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }

    .switch input { opacity: 0; width: 0; height: 0; }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(255, 255, 255, 0.15);
      transition: .3s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px; width: 18px;
      left: 3px; bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--accent-primary);
    }

    input:checked + .slider:before {
      transform: translateX(20px);
    }

    .badge-preview {
      background: rgba(15, 23, 42, 0.9);
      border: 1px dashed rgba(56, 189, 248, 0.4);
      padding: 14px;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 14px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .table-mini {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .table-mini th, .table-mini td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .table-mini th {
      color: var(--text-muted);
      font-size: 11px;
      text-transform: uppercase;
    }

    .pill {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    .pill-green { background: rgba(52, 211, 153, 0.15); color: #34d399; }
    .pill-blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .pill-yellow { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      border: 1px solid var(--accent-success);
      color: #34d399;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
      pointer-events: none;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <div class="header-logo">⚡</div>
        <div>
          <h1>Antigravity Usage Settings</h1>
          <div class="header-sub">Configure pre-execution estimation, status bar badges, and model ratio profiles</div>
        </div>
      </div>
      <div class="btn-group">
        <button class="btn" onclick="openSettingsFile()">📄 Open JSON in Editor</button>
        <button class="btn btn-primary" onclick="saveSettings()">💾 Save Settings</button>
      </div>
    </div>

    <div class="grid-2">
      <!-- General & Estimation Settings -->
      <div class="card">
        <div class="card-title">🎯 Pre-Execution Estimation & Models</div>
        
        <div class="form-group">
          <label for="defaultModel">Default Target Model</label>
          <select id="defaultModel" onchange="updateBadgePreview()">
            <option value="gemini-3.7-flash">Gemini 3.7 Flash (1.0x Baseline)</option>
            <option value="gemini-3.7-pro">Gemini 3.7 Pro (~1.46x Scaling)</option>
            <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (~1.60x Scaling)</option>
            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (~1.50x Scaling)</option>
            <option value="gpt-4o">GPT-4o (~1.35x Scaling)</option>
            <option value="deepseek-r1">DeepSeek R1 (~1.85x Scaling)</option>
            <option value="gemma-2">Gemma 2 Local (~0.85x Scaling)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="statusBarDisplayMode">Status Bar Badge Style</label>
          <select id="statusBarDisplayMode" onchange="updateBadgePreview()">
            <option value="detailed">Detailed (⚡ ~126.2k tok | 15 tools (95%))</option>
            <option value="compact">Compact (⚡ ~126.2k tok (95%))</option>
            <option value="model-tag">Model Tag (⚡ ~126.2k tok [gemini-3.7-pro])</option>
            <option value="minimal">Minimal (⚡ 126k)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="tokenWarningThreshold">Token Warning Threshold</label>
          <input type="number" id="tokenWarningThreshold" min="10000" max="1000000" step="5000" value="100000">
        </div>

        <div class="badge-preview">
          <span>Live Badge Preview:</span>
          <strong id="badgePreviewText">⚡ ~126.2k tok | 15 tools (95%)</strong>
        </div>
      </div>

      <!-- Sync & Automation Settings -->
      <div class="card">
        <div class="card-title">🔄 Background Sync & Wakeup Daemon</div>

        <div class="toggle-group">
          <div class="toggle-info">
            <h4>Auto-Sync Brain Transcripts</h4>
            <p>Automatically index implementation plans & action logs</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="autoSyncTranscripts">
            <span class="slider"></span>
          </label>
        </div>

        <div class="form-group">
          <label for="syncIntervalMinutes">Sync Interval (Minutes)</label>
          <input type="number" id="syncIntervalMinutes" min="1" max="1440" value="15">
        </div>

        <div class="toggle-group">
          <div class="toggle-info">
            <h4>Model Auto-Wakeup Daemon</h4>
            <p>Keep daily quota warm via Windows Task Scheduler / Cron</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="autoWakeupEnabled">
            <span class="slider"></span>
          </label>
        </div>

        <div class="form-group">
          <label for="wakeupSchedule">Wakeup Cron Schedule</label>
          <input type="text" id="wakeupSchedule" value="0 9 * * *">
        </div>
      </div>
    </div>

    <!-- Live Model Ratio Matrix -->
    <div class="card">
      <div class="card-title" style="justify-content: space-between;">
        <span>📊 Cross-Model Statistical Ratio Matrix</span>
        <button class="btn" style="padding: 4px 10px; font-size: 12px;" onclick="syncNow()">🔄 Recalibrate Matrix</button>
      </div>
      <table class="table-mini" id="ratiosTable">
        <thead>
          <tr>
            <th>Model Name</th>
            <th>Total Ratio</th>
            <th>Prompt Ratio</th>
            <th>Completion Ratio</th>
            <th>Sample Count</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody id="ratiosBody">
          <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Loading ratios...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Live Token Estimator Sandbox -->
    <div class="card">
      <div class="card-title">🔮 Interactive Estimation Sandbox</div>
      <div class="form-group">
        <label for="sandboxInput">Draft Prompt or Implementation Plan Markdown</label>
        <textarea id="sandboxInput" rows="3" placeholder="Type a prompt or paste plan markdown to test live estimation..."></textarea>
      </div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <button class="btn btn-primary" onclick="runSandboxEstimation()">⚡ Run Test Estimation</button>
        <div id="sandboxResult" style="font-family: var(--font-mono); font-size: 13px; color: #34d399;"></div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast">✅ Settings saved successfully</div>

  <script>
    async function loadData() {
      try {
        const [settingsRes, ratiosRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/ratios')
        ])

        const settings = await settingsRes.json()
        const ratios = await ratiosRes.json()

        document.getElementById('defaultModel').value = settings.defaultModel || 'gemini-3.7-flash'
        document.getElementById('statusBarDisplayMode').value = settings.statusBarDisplayMode || 'detailed'
        document.getElementById('tokenWarningThreshold').value = settings.tokenWarningThreshold || 100000
        document.getElementById('autoSyncTranscripts').checked = !!settings.autoSyncTranscripts
        document.getElementById('syncIntervalMinutes').value = settings.syncIntervalMinutes || 15
        document.getElementById('autoWakeupEnabled').checked = !!settings.autoWakeupEnabled
        document.getElementById('wakeupSchedule').value = settings.wakeupSchedule || '0 9 * * *'

        renderRatiosTable(ratios)
        updateBadgePreview()
      } catch (err) {
        console.error('Failed to load settings data', err)
      }
    }

    function renderRatiosTable(matrix) {
      const tbody = document.getElementById('ratiosBody')
      if (!matrix || !matrix.models) return

      tbody.innerHTML = ''
      const sorted = Object.values(matrix.models).sort((a, b) => b.totalRatio - a.totalRatio)

      for (const m of sorted) {
        const isBaseline = m.modelId === matrix.baselineModel
        const pillClass = isBaseline ? 'pill-blue' : m.sampleCount > 0 ? 'pill-green' : 'pill-yellow'
        const typeStr = isBaseline ? 'Baseline' : m.sampleCount > 0 ? 'Empirical' : 'Prior'

        const tr = document.createElement('tr')
        tr.innerHTML = \`
          <td><strong>\${m.displayName || m.modelId}</strong></td>
          <td><strong style="color: #38bdf8;">\${m.totalRatio.toFixed(2)}x</strong></td>
          <td>\${m.promptRatio.toFixed(2)}x</td>
          <td>\${m.completionRatio.toFixed(2)}x</td>
          <td>\${m.sampleCount}</td>
          <td><span class="pill \${pillClass}">\${typeStr}</span></td>
        \`
        tbody.appendChild(tr)
      }
    }

    function updateBadgePreview() {
      const model = document.getElementById('defaultModel').value
      const mode = document.getElementById('statusBarDisplayMode').value
      let preview = '⚡ ~126.2k tok | 15 tools (95%)'

      if (mode === 'compact') preview = '⚡ ~126.2k tok (95%)'
      if (mode === 'model-tag') preview = \`⚡ ~126.2k tok [\${model}]\`
      if (mode === 'minimal') preview = '⚡ 126k'

      document.getElementById('badgePreviewText').innerText = preview
    }

    async function saveSettings() {
      const payload = {
        defaultModel: document.getElementById('defaultModel').value,
        statusBarDisplayMode: document.getElementById('statusBarDisplayMode').value,
        tokenWarningThreshold: parseInt(document.getElementById('tokenWarningThreshold').value, 10) || 100000,
        autoSyncTranscripts: document.getElementById('autoSyncTranscripts').checked,
        syncIntervalMinutes: parseInt(document.getElementById('syncIntervalMinutes').value, 10) || 15,
        autoWakeupEnabled: document.getElementById('autoWakeupEnabled').checked,
        wakeupSchedule: document.getElementById('wakeupSchedule').value
      }

      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      showToast('✅ Settings saved successfully')
    }

    async function openSettingsFile() {
      const res = await fetch('/api/open-file', { method: 'POST' })
      const data = await res.json()
      showToast('📄 Opened in editor: ' + (data.path || 'settings.json'))
    }

    async function syncNow() {
      showToast('🔄 Recalibrating matrix from brain traces...')
      await fetch('/api/sync', { method: 'POST' })
      const ratiosRes = await fetch('/api/ratios')
      const ratios = await ratiosRes.json()
      renderRatiosTable(ratios)
      showToast('✅ Matrix recalibrated')
    }

    async function runSandboxEstimation() {
      const input = document.getElementById('sandboxInput').value || 'Port oauth credentials to antigravity'
      const model = document.getElementById('defaultModel').value
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, model })
      })
      const data = await res.json()
      document.getElementById('sandboxResult').innerText = \`Predicted: ~\${data.estimatedTokens.avg.toLocaleString()} tokens | \${data.estimatedToolCalls.avg} tools (\${Math.round(data.estimatedTokens.confidence * 100)}% conf)\`
    }

    function showToast(msg) {
      const toast = document.getElementById('toast')
      toast.innerText = msg
      toast.classList.add('show')
      setTimeout(() => toast.classList.remove('show'), 3500)
    }

    loadData()
  </script>
</body>
</html>`
}

/**
 * Start the zero-dependency local settings HTTP server
 */
export function startSettingsServer(options: { port?: number; openBrowser?: boolean } = {}): Promise<{ server: import('node:http').Server; url: string; port: number }> {
  const port = options.port || 3840
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`)

    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        })
        res.end()
        return
      }

      if (url.pathname === '/' && req.method === 'GET') {
        sendHtml(res, getSettingsDashboardHtml())
        return
      }

      if (url.pathname === '/api/settings') {
        if (req.method === 'GET') {
          sendJson(res, getSettings())
          return
        }
        if (req.method === 'POST') {
          const body = await parseJsonBody<Partial<AppSettings>>(req)
          const updated = updateSettings(body)
          sendJson(res, updated)
          return
        }
      }

      if (url.pathname === '/api/ratios' && req.method === 'GET') {
        sendJson(res, getModelRatios())
        return
      }

      if (url.pathname === '/api/stats' && req.method === 'GET') {
        const records = getArchivedRecords()
        sendJson(res, {
          totalArchived: records.length,
          lastUpdated: records[0]?.timestamp || null
        })
        return
      }

      if (url.pathname === '/api/sync' && req.method === 'POST') {
        const records = syncHistoricalBrainArtifacts()
        sendJson(res, { success: true, count: records.length })
        return
      }

      if (url.pathname === '/api/open-file' && req.method === 'POST') {
        const path = await openSettingsInEditor()
        sendJson(res, { success: true, path })
        return
      }

      if (url.pathname === '/api/estimate' && req.method === 'POST') {
        const body = await parseJsonBody<{ input: string; sourceType?: 'prompt' | 'plan'; model?: string }>(req)
        const result = estimateUsage(body.input || '', body.sourceType || 'prompt', body.model)
        sendJson(res, result)
        return
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
    } catch (err) {
      debug('settings-server', 'Server error', err)
      sendJson(res, { error: err instanceof Error ? err.message : 'Unknown server error' }, 500)
    }
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(port, () => {
      const serverUrl = `http://localhost:${port}`
      info(`⚙️  Settings server running at \x1b[36m${serverUrl}\x1b[0m`)
      if (options.openBrowser) {
        open(serverUrl).catch(() => {})
      }
      resolve({ server, url: serverUrl, port })
    })
  })
}
