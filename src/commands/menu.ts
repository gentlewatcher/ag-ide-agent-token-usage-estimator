/**
 * Menu command - launch interactive terminal QuickPick or export IDE context menu schema
 */

import { runInteractiveMenu, executeMenuItem } from '../menu/dispatcher.js'
import { error as logError } from '../core/logger.js'

export async function menuCommand(options: { json?: boolean; execute?: string } = {}): Promise<void> {
  try {
    if (options.execute) {
      await executeMenuItem(options.execute)
      return
    }

    await runInteractiveMenu(options)
  } catch (err) {
    logError(`Menu command failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    process.exit(1)
  }
}
