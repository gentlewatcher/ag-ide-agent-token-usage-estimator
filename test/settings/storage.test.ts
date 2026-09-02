import { describe, it, expect } from 'vitest'
import { 
  getSettings, 
  updateSettings, 
  getSetting, 
  setSetting, 
  resetSettings, 
  ensureSettingsDir 
} from '../../src/settings/storage.js'

describe('Settings Storage and Offline Schema', () => {
  it('ensures settings directory and generates valid schema', () => {
    const { dir, settingsPath, schemaPath } = ensureSettingsDir()
    expect(dir).toBeTruthy()
    expect(settingsPath).toContain('settings.json')
    expect(schemaPath).toContain('settings.schema.json')
  })

  it('reads default settings and handles updates', () => {
    const settings = getSettings()
    expect(settings).toHaveProperty('defaultModel')
    expect(settings).toHaveProperty('statusBarDisplayMode')
    expect(settings).toHaveProperty('autoSyncTranscripts')

    // Test update
    updateSettings({ defaultModel: 'claude-3-7-sonnet' })
    expect(getSetting('defaultModel')).toBe('claude-3-7-sonnet')

    // Test setSetting
    setSetting('statusBarDisplayMode', 'compact')
    expect(getSetting('statusBarDisplayMode')).toBe('compact')

    // Reset back to defaults
    resetSettings()
    expect(getSetting('defaultModel')).toBe('gemini-3.7-flash')
  })
})
