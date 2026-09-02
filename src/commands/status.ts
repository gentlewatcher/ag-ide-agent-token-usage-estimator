/**
 * Status command - show current login status
 */

import { getTokenManager, getTokenManagerForAccount } from '../google/token-manager.js'
import { getAccountManager } from '../accounts/index.js'
import { maskEmail, maskToken } from '../core/mask.js'
import { info, warn } from '../core/logger.js'
import { isDebugMode } from '../core/logger.js'
import Table from 'cli-table3'

interface StatusOptions {
  all?: boolean
  account?: string
}

/**
 * Show status for a single account
 */
function showSingleAccountStatus(email?: string): void {
  const tokenManager = email 
    ? getTokenManagerForAccount(email)
    : getTokenManager()
  
  console.log()
  console.log('📍 Antigravity Usage Status')
  console.log('─'.repeat(40))
  
  if (!tokenManager.isLoggedIn()) {
    warn('Not logged in')
    console.log()
    info('Run `antigravity-usage login` to authenticate.')
    console.log()
    return
  }
  
  const accountEmail = tokenManager.getEmail()
  const expiresAt = tokenManager.getExpiresAt()
  const isExpired = tokenManager.isTokenExpired()
  
  console.log(`✅ Logged in: Yes`)
  
  if (accountEmail) {
    console.log(`📧 Email: ${maskEmail(accountEmail)}`)
  }
  
  if (expiresAt) {
    const expiryStr = expiresAt.toLocaleString()
    const status = isExpired ? ' (expired/expiring soon)' : ''
    console.log(`⏰ Token expires: ${expiryStr}${status}`)
  }
  
  // Debug mode shows more detail
  if (isDebugMode()) {
    const tokens = email 
      ? getAccountManager().getTokens(email)
      : getAccountManager().getActiveTokens()
    if (tokens) {
      console.log()
      console.log('Debug info:')
      console.log(`  Access token: ${maskToken(tokens.accessToken)}`)
      console.log(`  Refresh token: ${maskToken(tokens.refreshToken)}`)
    }
  }
  
  console.log()
}

/**
 * Show status for all accounts
 */
function showAllAccountsStatus(): void {
  const manager = getAccountManager()
  const emails = manager.getAccountEmails()
  const activeEmail = manager.getActiveEmail()
  
  console.log()
  console.log('📍 Antigravity Usage Status - All Accounts')
  console.log('═'.repeat(60))
  
  if (emails.length === 0) {
    warn('No accounts found.')
    console.log()
    info('Run `antigravity-usage login` to add an account.')
    console.log()
    return
  }
  
  const table = new Table({
    head: ['Account', 'Logged In', 'Token Expiry'],
    style: {
      head: ['cyan'],
      border: ['gray']
    },
    colWidths: [30, 12, 28]
  })
  
  for (const email of emails) {
    const tokenManager = getTokenManagerForAccount(email)
    const isActive = email === activeEmail
    const nameDisplay = isActive ? `${email} [*]` : email
    
    if (tokenManager.isLoggedIn()) {
      const expiresAt = tokenManager.getExpiresAt()
      const isExpired = tokenManager.isTokenExpired()
      
      let expiryDisplay = '-'
      if (expiresAt) {
        expiryDisplay = expiresAt.toLocaleString()
        if (isExpired) {
          expiryDisplay = `⚠️ ${expiryDisplay}`
        }
      }
      
      table.push([
        nameDisplay,
        '✅',
        expiryDisplay
      ])
    } else {
      table.push([
        nameDisplay,
        '❌',
        'Invalid or missing'
      ])
    }
  }
  
  console.log(table.toString())
  console.log()
  console.log('[*] = active account')
  console.log()
}

export function statusCommand(options: StatusOptions = {}): void {
  if (options.all) {
    showAllAccountsStatus()
    return
  }
  
  if (options.account) {
    const manager = getAccountManager()
    if (!manager.hasAccount(options.account)) {
      warn(`Account '${options.account}' not found.`)
      return
    }
    showSingleAccountStatus(options.account)
    return
  }
  
  showSingleAccountStatus()
}
