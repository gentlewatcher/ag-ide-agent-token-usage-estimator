/**
 * Settings storage manager and in-editor configuration launcher
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exec, spawn } from 'node:child_process'
import { getGeminiHomeDir } from '../core/env.js'
import { debug } from '../core/logger.js'
import { 
  DEFAULT_APP_SETTINGS, 
  SETTINGS_JSON_SCHEMA, 
  type AppSettings 
} from './types.js'

/**
 * Ensure directory and local offline JSON Schema exist
 */
export function ensureSettingsDir(): { dir: string; settingsPath: string; schemaPath: string } {
  const dir = join(getGeminiHomeDir(), 'antigravity-usage')
  const settingsPath = join(dir, 'settings.json')
  const schemaPath = join(dir, 'settings.schema.json')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Always keep local offline schema up-to-date
  try {
    writeFileSync(schemaPath, JSON.stringify(SETTINGS_JSON_SCHEMA, null, 2), 'utf-8')
  } catch (err) {
    debug('settings-storage', 'Failed to write settings.schema.json', err)
  }

  return { dir, settingsPath, schemaPath }
}

/**
 * Load application settings from disk with fallback to defaults
 */
export function getSettings(): AppSettings {
  const { settingsPath } = ensureSettingsDir()

  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8')
      const parsed = JSON.parse(content) as Partial<AppSettings>
      return {
        ...DEFAULT_APP_SETTINGS,
        ...parsed,
        $schema: './settings.schema.json'
      }
    } catch (err) {
      debug('settings-storage', 'Failed to read settings.json, returning defaults', err)
    }
  }

  const initial = { ...DEFAULT_APP_SETTINGS }
  saveSettings(initial)
  return initial
}

/**
 * Save settings object to disk
 */
export function saveSettings(settings: AppSettings): void {
  const { settingsPath } = ensureSettingsDir()
  try {
    const formatted = {
      $schema: './settings.schema.json',
      ...settings
    }
    writeFileSync(settingsPath, JSON.stringify(formatted, null, 2), 'utf-8')
  } catch (err) {
    debug('settings-storage', 'Failed to write settings.json', err)
  }
}

/**
 * Update partial settings fields
 */
export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated: AppSettings = {
    ...current,
    ...partial,
    $schema: './settings.schema.json'
  }
  saveSettings(updated)
  return updated
}

/**
 * Get a specific configuration property
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settings = getSettings()
  return settings[key]
}

/**
 * Set a specific configuration property
 */
export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): AppSettings {
  return updateSettings({ [key]: value })
}

/**
 * Reset settings back to initial defaults
 */
export function resetSettings(): AppSettings {
  const reset = { ...DEFAULT_APP_SETTINGS }
  saveSettings(reset)
  return reset
}

/**
 * Open the settings.json file directly in the active IDE or default editor
 */
export function openSettingsInEditor(): Promise<string> {
  const { settingsPath } = ensureSettingsDir()

  // Make sure settings.json exists before opening
  if (!existsSync(settingsPath)) {
    saveSettings(DEFAULT_APP_SETTINGS)
  }

  return new Promise((resolve, reject) => {
    const customEditor = process.env.VISUAL || process.env.EDITOR

    if (customEditor) {
      const child = spawn(customEditor, [settingsPath], { detached: true, stdio: 'ignore' })
      child.unref()
      resolve(settingsPath)
      return
    }

    // Try VS Code / Antigravity CLI launcher first
    exec(`code -r "${settingsPath}"`, (err) => {
      if (!err) {
        resolve(settingsPath)
        return
      }

      // Fallback to system default text editor
      if (process.platform === 'win32') {
        exec(`start "" "${settingsPath}"`, (e) => {
          if (e) reject(e)
          else resolve(settingsPath)
        })
      } else if (process.platform === 'darwin') {
        exec(`open "${settingsPath}"`, (e) => {
          if (e) reject(e)
          else resolve(settingsPath)
        })
      } else {
        exec(`xdg-open "${settingsPath}"`, (e) => {
          if (e) reject(e)
          else resolve(settingsPath)
        })
      }
    })
  })
}
