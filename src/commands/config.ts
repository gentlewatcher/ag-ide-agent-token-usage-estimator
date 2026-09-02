/**
 * Config command - command-line property getter/setter and in-editor launcher
 */

import Table from 'cli-table3'
import { 
  getSettings, 
  getSetting, 
  setSetting, 
  resetSettings, 
  openSettingsInEditor 
} from '../settings/storage.js'
import { error as logError, info } from '../core/logger.js'
import type { AppSettings } from '../settings/types.js'

export async function configCommand(
  action: 'get' | 'set' | 'list' | 'open' | 'reset', 
  key?: string, 
  value?: string, 
  options: { json?: boolean } = {}
): Promise<void> {
  try {
    if (action === 'open') {
      info('📄 Opening settings.json directly in IDE editor...')
      const path = await openSettingsInEditor()
      console.log(`✅ Opened \x1b[36m${path}\x1b[0m in editor.\n`)
      return
    }

    if (action === 'reset') {
      const reset = resetSettings()
      console.log('✅ Settings reset to defaults.')
      if (options.json) console.log(JSON.stringify(reset, null, 2))
      return
    }

    if (action === 'get') {
      if (!key) {
        logError('Please specify a setting key to get, e.g. "config get defaultModel"')
        process.exit(1)
      }
      const val = getSetting(key as keyof AppSettings)
      if (options.json) {
        console.log(JSON.stringify({ [key]: val }, null, 2))
      } else {
        console.log(`${key}: \x1b[36m\x1b[1m${JSON.stringify(val)}\x1b[0m`)
      }
      return
    }

    if (action === 'set') {
      if (!key || value === undefined) {
        logError('Please specify key and value, e.g. "config set defaultModel gemini-3.7-pro"')
        process.exit(1)
      }

      let parsedValue: unknown = value
      if (value === 'true') parsedValue = true
      else if (value === 'false') parsedValue = false
      else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value)

      const updated = setSetting(key as keyof AppSettings, parsedValue as never)
      console.log(`✅ Set \x1b[1m${key}\x1b[0m = \x1b[36m${JSON.stringify(parsedValue)}\x1b[0m`)
      if (options.json) console.log(JSON.stringify(updated, null, 2))
      return
    }

    // Default action: 'list'
    const settings = getSettings()
    if (options.json) {
      console.log(JSON.stringify(settings, null, 2))
      return
    }

    console.log('\n⚙️  \x1b[1mAntigravity Usage Configuration\x1b[0m\n')
    const table = new Table({
      head: ['\x1b[1mSetting Key\x1b[0m', '\x1b[1mConfigured Value\x1b[0m', '\x1b[1mDescription\x1b[0m'],
      style: { head: [], border: [] }
    })

    table.push(
      ['defaultModel', `\x1b[36m${settings.defaultModel}\x1b[0m`, 'Default estimation target model'],
      ['statusBarDisplayMode', `\x1b[36m${settings.statusBarDisplayMode}\x1b[0m`, 'Bottom status bar badge format'],
      ['tokenWarningThreshold', `\x1b[36m${settings.tokenWarningThreshold.toLocaleString()}\x1b[0m`, 'Threshold for high-usage warning badge'],
      ['autoSyncTranscripts', `\x1b[36m${settings.autoSyncTranscripts}\x1b[0m`, 'Background auto-discovery of brain logs'],
      ['syncIntervalMinutes', `\x1b[36m${settings.syncIntervalMinutes}m\x1b[0m`, 'Transcript sync interval'],
      ['autoWakeupEnabled', `\x1b[36m${settings.autoWakeupEnabled}\x1b[0m`, 'Model quota auto-wakeup daemon'],
      ['wakeupSchedule', `\x1b[36m${settings.wakeupSchedule}\x1b[0m`, 'Cron trigger schedule'],
      ['showAutocompleteModels', `\x1b[36m${settings.showAutocompleteModels}\x1b[0m`, 'Show autocomplete models in quota']
    )

    console.log(table.toString())
    console.log('\nTip: Run `antigravity-usage config open` to edit directly in your IDE with JSON Schema autocomplete.\n')
  } catch (err) {
    logError(`Config command failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    process.exit(1)
  }
}
