/**
 * Lightweight cross-platform URL opener without external ESM dependencies
 */
import { exec } from 'child_process'

export async function openUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    let command = ''
    if (process.platform === 'win32') {
      command = `start "" "${url.replace(/"/g, '""')}"`
    } else if (process.platform === 'darwin') {
      command = `open "${url.replace(/"/g, '\\"')}"`
    } else {
      command = `xdg-open "${url.replace(/"/g, '\\"')}"`
    }

    exec(command, () => {
      resolve()
    })
  })
}

export default openUrl
