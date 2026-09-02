import { describe, it, expect } from 'vitest'
import { startSettingsServer, getSettingsDashboardHtml } from '../../src/settings/server.js'

describe('Settings Server and Dashboard', () => {
  it('generates non-empty HTML dashboard with styling and scripts', () => {
    const html = getSettingsDashboardHtml()
    expect(html).toContain('Antigravity Usage Settings')
    expect(html).toContain('defaultModel')
    expect(html).toContain('/api/settings')
    expect(html).toContain('/api/ratios')
  })

  it('starts local HTTP server and responds to REST API requests', async () => {
    const { server, url, port } = await startSettingsServer({ port: 3845, openBrowser: false })

    expect(url).toContain('3845')

    // Test GET /api/settings
    const res = await fetch(`http://localhost:${port}/api/settings`)
    expect(res.status).toBe(200)
    const settings = await res.json()
    expect(settings).toHaveProperty('defaultModel')

    // Test GET /api/ratios
    const ratioRes = await fetch(`http://localhost:${port}/api/ratios`)
    expect(ratioRes.status).toBe(200)
    const ratios = await ratioRes.json()
    expect(ratios).toHaveProperty('models')

    // Close server
    await new Promise<void>(resolve => server.close(() => resolve()))
  })
})
