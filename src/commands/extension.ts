/**
 * CLI command for managing Antigravity IDE extension installation and deployment
 */

import { deployExtension } from '../../scripts/deploy-extension.js'

export async function extensionCommand(
  action?: string,
  options: { clean?: boolean; skipBuild?: boolean } = {}
): Promise<void> {
  if (action === 'clean' || options.clean) {
    deployExtension({ cleanOnly: true })
  } else {
    deployExtension({ skipBuild: options.skipBuild })
  }
}
