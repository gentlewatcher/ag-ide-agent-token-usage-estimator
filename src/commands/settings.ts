/**
 * Settings command - launch web settings dashboard or open JSON in editor
 */

import { openSettingsInEditor, getSettings } from '../settings/storage.js'
import { startSettingsServer } from '../settings/server.js'
import { error as logError, info } from '../core/logger.js'

export interface SettingsCommandOptions {
  open?: boolean
  web?: boolean
  port?: string
  json?: boolean
}

export async function settingsCommand(options: SettingsCommandOptions = {}): Promise<void> {
  try {
    if (options.json) {
      console.log(JSON.stringify(getSettings(), null, 2))
      return
    }

    if (options.open) {
      info('📄 Opening settings.json with offline schema in editor...')
      const filePath = await openSettingsInEditor()
      console.log(`✅ Opened \x1b[36m${filePath}\x1b[0m in editor tab.\n`)
      return
    }

    // Default to launching web dashboard unless specifically headless
    const port = options.port ? parseInt(options.port, 10) : 3840
    info(`🌐 Launching Antigravity Usage Settings Dashboard on port ${port}...`)
    const { url } = await startSettingsServer({ port, openBrowser: true })

    console.log(`\n🚀 Dashboard active at \x1b[36m${url}\x1b[0m`)
    console.log(`Press \x1b[1mCtrl+C\x1b[0m to stop the server.\n`)

    // Keep process alive for user interaction
    await new Promise(() => {})
  } catch (err) {
    logError(`Settings command failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    process.exit(1)
  }
}
