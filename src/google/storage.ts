/**
 * Token storage - file-based implementation
 * 
 * This module provides backward-compatible token storage.
 * It routes to the active account in the new multi-account structure.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { 
  getTokensPath, 
  getConfigDir, 
  getAccountDir,
  getAntigravityOAuthCredsPath,
  getAntigravityGoogleAccountsPath
} from '../core/env.js'
import { debug } from '../core/logger.js'
import { 
  getActiveAccountEmail,
  setActiveAccountEmail
} from '../accounts/config.js'
import {
  saveAccountTokens,
  loadAccountTokens,
  deleteAccount,
  accountExists
} from '../accounts/storage.js'
import type { StoredTokens } from '../quota/types.js'

/**
 * Helper to extract email from JWT id_token
 */
function extractEmailFromIdToken(idToken?: string): string | undefined {
  if (!idToken) return undefined
  try {
    const parts = idToken.split('.')
    if (parts.length < 2) return undefined
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8')
    const parsed = JSON.parse(payload)
    return typeof parsed.email === 'string' ? parsed.email : undefined
  } catch {
    return undefined
  }
}

/**
 * Load tokens directly from native Antigravity/Gemini environment (~/.gemini/oauth_creds.json)
 */
export function loadNativeAntigravityTokens(): StoredTokens | null {
  const credsPath = getAntigravityOAuthCredsPath()
  if (!existsSync(credsPath)) {
    return null
  }

  try {
    const content = readFileSync(credsPath, 'utf-8')
    const creds = JSON.parse(content) as {
      access_token?: string
      refresh_token?: string
      expiry_date?: number
      id_token?: string
      token_type?: string
    }

    if (!creds.access_token) {
      return null
    }

    let email: string | undefined

    // Try reading active email from ~/.gemini/google_accounts.json
    const accountsPath = getAntigravityGoogleAccountsPath()
    if (existsSync(accountsPath)) {
      try {
        const accountsData = JSON.parse(readFileSync(accountsPath, 'utf-8')) as { active?: string }
        if (typeof accountsData.active === 'string' && accountsData.active.length > 0) {
          email = accountsData.active
        }
      } catch (e) {
        debug('storage', 'Could not read active email from google_accounts.json', e)
      }
    }

    // Fallback: extract email from id_token
    if (!email && creds.id_token) {
      email = extractEmailFromIdToken(creds.id_token)
    }

    debug('storage', `Loaded native Antigravity tokens for ${email || 'unknown user'}`)

    return {
      accessToken: creds.access_token,
      refreshToken: creds.refresh_token || '',
      expiresAt: creds.expiry_date || Date.now() + 3600 * 1000,
      email
    }
  } catch (err) {
    debug('storage', 'Failed to read native Antigravity credentials', err)
    return null
  }
}


/**
 * Save tokens to disk
 * Routes to active account in multi-account structure
 */
export function saveTokens(tokens: StoredTokens): void {
  const email = tokens.email
  
  if (!email) {
    // Fallback to legacy storage if no email
    const path = getTokensPath()
    const dir = dirname(path)
    
    debug('storage', `Saving tokens to legacy path ${path}`)
    
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    
    writeFileSync(path, JSON.stringify(tokens, null, 2), { mode: 0o600 })
    return
  }
  
  // Use multi-account storage
  debug('storage', `Saving tokens for account ${email}`)
  saveAccountTokens(email, tokens)
  
  // Set as active if no active account
  if (!getActiveAccountEmail()) {
    setActiveAccountEmail(email)
  }
}

/**
 * Load tokens from disk
 * First tries active account, then native Antigravity environment (~/.gemini), then falls back to legacy path
 */
export function loadTokens(): StoredTokens | null {
  // Try active account first
  const activeEmail = getActiveAccountEmail()
  
  if (activeEmail) {
    const tokens = loadAccountTokens(activeEmail)
    if (tokens) {
      debug('storage', `Loaded tokens for active account ${activeEmail}`)
      return tokens
    }
  }

  // Try native Antigravity environment credentials
  const nativeTokens = loadNativeAntigravityTokens()
  if (nativeTokens) {
    debug('storage', 'Loaded tokens from native Antigravity environment (~/.gemini)')
    return nativeTokens
  }
  
  // Fallback to legacy path
  const legacyPath = getTokensPath()
  
  debug('storage', `Loading tokens from legacy path ${legacyPath}`)
  
  if (!existsSync(legacyPath)) {
    debug('storage', 'No tokens file found')
    return null
  }
  
  try {
    const content = readFileSync(legacyPath, 'utf-8')
    const tokens = JSON.parse(content) as StoredTokens
    debug('storage', 'Tokens loaded successfully from legacy path')
    return tokens
  } catch (err) {
    debug('storage', 'Failed to parse tokens file', err)
    return null
  }
}

/**
 * Delete stored tokens
 * Removes active account in multi-account structure
 */
export function deleteTokens(): boolean {
  const activeEmail = getActiveAccountEmail()
  
  if (activeEmail && accountExists(activeEmail)) {
    debug('storage', `Deleting account ${activeEmail}`)
    return deleteAccount(activeEmail)
  }
  
  // Fallback to legacy path
  const path = getTokensPath()
  
  debug('storage', `Deleting tokens at legacy path ${path}`)
  
  if (!existsSync(path)) {
    debug('storage', 'No tokens file to delete')
    return false
  }
  
  try {
    unlinkSync(path)
    debug('storage', 'Tokens deleted successfully')
    return true
  } catch (err) {
    debug('storage', 'Failed to delete tokens', err)
    return false
  }
}

/**
 * Check if tokens exist (in active account, native Antigravity environment, or legacy tokens)
 */
export function hasTokens(): boolean {
  // Check active account
  const activeEmail = getActiveAccountEmail()
  if (activeEmail && accountExists(activeEmail)) {
    return true
  }

  // Check native Antigravity environment
  const nativeCredsPath = getAntigravityOAuthCredsPath()
  if (existsSync(nativeCredsPath)) {
    return true
  }
  
  // Fallback to legacy
  return existsSync(getTokensPath())
}

/**
 * Get config directory info for doctor command
 */
export function getStorageInfo(): { 
  configDir: string
  tokensPath: string
  exists: boolean
  nativeCredsPath: string
  nativeExists: boolean
} {
  const configDir = getConfigDir()
  const activeEmail = getActiveAccountEmail()
  const nativeCredsPath = getAntigravityOAuthCredsPath()
  const nativeExists = existsSync(nativeCredsPath)
  
  // Prefer active account path
  let tokensPath: string
  let exists: boolean
  
  if (activeEmail) {
    tokensPath = `${getAccountDir(activeEmail)}/tokens.json`
    exists = accountExists(activeEmail)
  } else if (nativeExists) {
    tokensPath = nativeCredsPath
    exists = true
  } else {
    tokensPath = getTokensPath()
    exists = existsSync(tokensPath)
  }
  
  return {
    configDir,
    tokensPath,
    exists,
    nativeCredsPath,
    nativeExists
  }
}

