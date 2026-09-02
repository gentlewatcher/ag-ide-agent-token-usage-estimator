/**
 * Doctor command - diagnostics and troubleshooting
 */

import { getTokenManager } from '../google/token-manager.js'
import { getStorageInfo } from '../google/storage.js'
import { getConfigDir, getPlatform, getGeminiHomeDir, getAntigravityBrainDirs, getAntigravityHistoryDirs } from '../core/env.js'
import { discoverConversationTranscripts } from '../agent/transcript-parser.js'
import { maskEmail } from '../core/mask.js'
import { version } from '../version'
import { existsSync } from 'node:fs'

export function doctorCommand(): void {
  console.log()
  console.log('🩺 Antigravity Usage - Diagnostics')
  console.log('═'.repeat(50))
  console.log()
  
  // Version info
  console.log('📦 Version')
  console.log('─'.repeat(40))
  console.log(`  CLI version: ${version}`)
  console.log(`  Node.js: ${process.version}`)
  console.log(`  Platform: ${getPlatform()}`)
  console.log()
  
  // Config paths
  const storage = getStorageInfo()
  console.log('📁 Configuration')
  console.log('─'.repeat(40))
  console.log(`  Config dir: ${storage.configDir}`)
  console.log(`  Tokens file: ${storage.tokensPath}`)
  console.log(`  Tokens exist: ${storage.exists ? 'Yes' : 'No'}`)
  console.log(`  Native Antigravity creds: ${storage.nativeExists ? 'Found (~/.gemini/oauth_creds.json)' : 'Not found'}`)
  console.log()
  
  // Antigravity Agent Runtime
  const geminiHome = getGeminiHomeDir()
  const brainDirs = getAntigravityBrainDirs()
  const historyDirs = getAntigravityHistoryDirs()
  const conversations = discoverConversationTranscripts()

  console.log('🤖 Antigravity Agent Runtime')
  console.log('─'.repeat(40))
  console.log(`  Gemini home: ${geminiHome} (${existsSync(geminiHome) ? 'Found' : 'Not found'})`)
  console.log(`  Brain directories checked: ${brainDirs.length}`)
  console.log(`  History directories checked: ${historyDirs.length}`)
  console.log(`  Active conversations discovered: ${conversations.length}`)
  console.log()

  // Auth status
  const tokenManager = getTokenManager()
  console.log('🔐 Authentication')
  console.log('─'.repeat(40))
  
  if (!tokenManager.isLoggedIn()) {
    console.log('  Status: Not logged in')
    console.log()
    console.log('  💡 Run `antigravity-usage login` or launch Antigravity IDE.')
  } else {
    console.log('  Status: Logged in')
    
    const email = tokenManager.getEmail()
    if (email) {
      console.log(`  Email: ${maskEmail(email)}`)
    }
    
    const expiresAt = tokenManager.getExpiresAt()
    if (expiresAt) {
      const isExpired = tokenManager.isTokenExpired()
      console.log(`  Token expires: ${expiresAt.toLocaleString()}`)
      console.log(`  Token valid: ${isExpired ? 'No (needs refresh)' : 'Yes'}`)
    }
  }
  
  console.log()
  
  // Environment variables
  console.log('🔧 OAuth Configuration')
  console.log('─'.repeat(40))
  const hasClientId = !!process.env.ANTIGRAVITY_OAUTH_CLIENT_ID
  const hasClientSecret = !!process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET
  
  if (hasClientId || hasClientSecret) {
    console.log('  Using custom OAuth credentials:')
    console.log(`    ANTIGRAVITY_OAUTH_CLIENT_ID: ${hasClientId ? 'Set' : 'Not set'}`)
    console.log(`    ANTIGRAVITY_OAUTH_CLIENT_SECRET: ${hasClientSecret ? 'Set' : 'Not set'}`)
  } else {
    console.log('  ✅ Using official Antigravity OAuth client credentials')
  }
  
  console.log()
}

