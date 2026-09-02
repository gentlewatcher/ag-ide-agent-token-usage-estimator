/**
 * Environment and platform utilities
 */

import { homedir, platform } from 'node:os'
import { join } from 'node:path'

export type Platform = 'windows' | 'macos' | 'linux'

/**
 * Get the current platform
 */
export function getPlatform(): Platform {
  const p = platform()
  if (p === 'win32') return 'windows'
  if (p === 'darwin') return 'macos'
  return 'linux'
}

/**
 * Get the config directory for this application
 * - Windows: %APPDATA%/antigravity-usage
 * - macOS: ~/Library/Application Support/antigravity-usage
 * - Linux: ~/.config/antigravity-usage
 */
export function getConfigDir(): string {
  const p = getPlatform()
  const home = homedir()
  
  switch (p) {
    case 'windows':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'antigravity-usage')
    case 'macos':
      return join(home, 'Library', 'Application Support', 'antigravity-usage')
    case 'linux':
    default:
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'antigravity-usage')
  }
}

/**
 * Get the path to the tokens file (legacy - single account)
 */
export function getTokensPath(): string {
  return join(getConfigDir(), 'tokens.json')
}

/**
 * Get the accounts directory
 */
export function getAccountsDir(): string {
  return join(getConfigDir(), 'accounts')
}

/**
 * Get the directory for a specific account
 * @param email Account email address
 */
export function getAccountDir(email: string): string {
  // Sanitize email for filesystem (replace special chars)
  const safeName = email.replace(/[^a-zA-Z0-9@._-]/g, '_')
  return join(getAccountsDir(), safeName)
}

/**
 * Get the path to global config file
 */
export function getGlobalConfigPath(): string {
  return join(getConfigDir(), 'config.json')
}

/**
 * Get the root directory for Gemini/Antigravity user data (~/.gemini)
 */
export function getGeminiHomeDir(): string {
  const home = homedir()
  return join(home, '.gemini')
}

/**
 * Get the path to Antigravity native OAuth credentials (~/.gemini/oauth_creds.json)
 */
export function getAntigravityOAuthCredsPath(): string {
  return join(getGeminiHomeDir(), 'oauth_creds.json')
}

/**
 * Get the path to Antigravity active/known Google accounts (~/.gemini/google_accounts.json)
 */
export function getAntigravityGoogleAccountsPath(): string {
  return join(getGeminiHomeDir(), 'google_accounts.json')
}

/**
 * Get potential Antigravity brain / conversation directories
 * - ~/.gemini/antigravity-ide/brain
 * - %APPDATA%/antigravity-ide/brain (Windows)
 * - ~/Library/Application Support/antigravity-ide/brain (macOS)
 * - ~/.config/antigravity-ide/brain (Linux)
 */
export function getAntigravityBrainDirs(): string[] {
  const home = homedir()
  const p = getPlatform()
  const dirs: string[] = [
    join(getGeminiHomeDir(), 'antigravity-ide', 'brain'),
    join(getGeminiHomeDir(), 'brain')
  ]

  switch (p) {
    case 'windows':
      if (process.env.APPDATA) {
        dirs.push(join(process.env.APPDATA, 'antigravity-ide', 'brain'))
      }
      break
    case 'macos':
      dirs.push(join(home, 'Library', 'Application Support', 'antigravity-ide', 'brain'))
      break
    case 'linux':
    default:
      if (process.env.XDG_CONFIG_HOME) {
        dirs.push(join(process.env.XDG_CONFIG_HOME, 'antigravity-ide', 'brain'))
      }
      dirs.push(join(home, '.config', 'antigravity-ide', 'brain'))
      break
  }

  return dirs
}

/**
 * Get Antigravity conversation history directories
 */
export function getAntigravityHistoryDirs(): string[] {
  const home = homedir()
  return [
    join(getGeminiHomeDir(), 'history'),
    join(getGeminiHomeDir(), 'antigravity-ide', 'history')
  ]
}

