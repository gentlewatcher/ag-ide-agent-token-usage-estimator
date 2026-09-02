/**
 * Accounts command - manage multiple accounts
 */

import { getAccountManager } from '../accounts/index.js'
import { startOAuthFlow } from '../google/oauth.js'
import { getTokenManagerForAccount, resetTokenManager } from '../google/token-manager.js'
import { renderAccountsTable } from '../render/table.js'
import { success, warn, error as logError, info } from '../core/logger.js'

interface ListOptions {
  refresh?: boolean
}

interface RemoveOptions {
  force?: boolean
}

interface RefreshOptions {
  all?: boolean
}

/**
 * List all accounts
 */
export function listAccountsCommand(options: ListOptions): void {
  const manager = getAccountManager()
  const summaries = manager.getAccountSummaries()
  
  renderAccountsTable(summaries)
  
  if (options.refresh) {
    info('Use `antigravity-usage quota --all --refresh` to fetch fresh quota data.')
  }
}

/**
 * Add a new account (triggers OAuth flow)
 */
export async function addAccountCommand(): Promise<void> {
  info('Adding a new account...')
  
  const result = await startOAuthFlow()
  
  if (result.success) {
    success(`Account added successfully${result.email ? `: ${result.email}` : ''}!`)
    
    // Show updated account list
    const manager = getAccountManager()
    const summaries = manager.getAccountSummaries()
    console.log('\nYour accounts:')
    renderAccountsTable(summaries)
  } else {
    logError(`Failed to add account: ${result.error}`)
    process.exit(1)
  }
}

/**
 * Switch active account
 */
export function switchAccountCommand(email: string): void {
  const manager = getAccountManager()
  
  // Check if account exists
  if (!manager.hasAccount(email)) {
    logError(`Account '${email}' not found.`)
    
    const emails = manager.getAccountEmails()
    if (emails.length > 0) {
      console.log('\nAvailable accounts:')
      for (const e of emails) {
        console.log(`  - ${e}`)
      }
    } else {
      info('\nNo accounts found. Run `antigravity-usage login` to add one.')
    }
    
    process.exit(1)
  }
  
  // Switch account
  const switched = manager.setActiveAccount(email)
  
  if (switched) {
    success(`Switched to account: ${email}`)
  } else {
    logError(`Failed to switch to account: ${email}`)
    process.exit(1)
  }
}

/**
 * Remove an account
 */
export function removeAccountCommand(email: string, options: RemoveOptions): void {
  const manager = getAccountManager()
  
  // Check if account exists
  if (!manager.hasAccount(email)) {
    logError(`Account '${email}' not found.`)
    process.exit(1)
  }
  
  // Confirmation warning (unless --force)
  if (!options.force) {
    warn(`This will remove account '${email}' and all its data.`)
    info('Use --force to skip this warning.')
    // In a real CLI, we'd prompt for confirmation here
    // For now, just proceed
  }
  
  const removed = manager.removeAccount(email)
  
  if (removed) {
    success(`Account '${email}' removed.`)
    
    // Show remaining accounts
    const remaining = manager.getAccountEmails()
    if (remaining.length > 0) {
      const active = manager.getActiveEmail()
      console.log(`\nActive account: ${active || 'none'}`)
      console.log(`Remaining accounts: ${remaining.length}`)
    } else {
      info('\nNo accounts remaining. Run `antigravity-usage login` to add one.')
    }
  } else {
    logError(`Failed to remove account: ${email}`)
    process.exit(1)
  }
}

/**
 * Show current active account
 */
export function currentAccountCommand(): void {
  const manager = getAccountManager()
  const active = manager.getActiveEmail()
  
  if (active) {
    console.log()
    console.log(`📍 Active account: ${active}`)
    
    // Get account info
    const info = manager.getAccountInfo(active)
    if (info) {
      const statusIcon = info.status === 'valid' ? '✅' : 
                        info.status === 'expired' ? '⚠️' : '❌'
      console.log(`   Status: ${statusIcon} ${info.status}`)
      
      if (info.tokens?.expiresAt) {
        const expiresAt = new Date(info.tokens.expiresAt).toLocaleString()
        console.log(`   Token expires: ${expiresAt}`)
      }
    }
    console.log()
  } else {
    warn('No active account set.')
    
    const emails = manager.getAccountEmails()
    if (emails.length > 0) {
      console.log('\nAvailable accounts:')
      for (const e of emails) {
        console.log(`  - ${e}`)
      }
      info('\nRun `antigravity-usage accounts switch <email>` to set an active account.')
    } else {
      info('\nRun `antigravity-usage login` to add an account.')
    }
  }
}

/**
 * Refresh account tokens
 */
export async function refreshAccountCommand(email: string | undefined, options: RefreshOptions): Promise<void> {
  const manager = getAccountManager()
  
  // Refresh all accounts
  if (options.all) {
    const emails = manager.getAccountEmails()
    
    if (emails.length === 0) {
      warn('No accounts to refresh.')
      return
    }
    
    console.log(`\n🔄 Refreshing ${emails.length} account(s)...\n`)
    
    let successCount = 0
    let failCount = 0
    
    for (const e of emails) {
      try {
        const tokenManager = getTokenManagerForAccount(e)
        if (tokenManager.isTokenExpired()) {
          await tokenManager.refreshToken()
          success(`  ✅ ${e}`)
          successCount++
        } else {
          info(`  ⏭️  ${e} (token still valid)`)
          successCount++
        }
      } catch (err) {
        logError(`  ❌ ${e}: ${err instanceof Error ? err.message : 'Failed'}`)
        failCount++
      }
    }
    
    resetTokenManager()
    
    console.log()
    if (failCount > 0) {
      warn(`${failCount} account(s) need re-authentication. Run: antigravity-usage login`)
    } else {
      success(`All ${successCount} account(s) refreshed successfully!`)
    }
    return
  }
  
  // Refresh specific or active account
  const targetEmail = email || manager.getActiveEmail()
  
  if (!targetEmail) {
    logError('No account specified and no active account.')
    info('Usage: antigravity-usage accounts refresh <email>')
    info('   or: antigravity-usage accounts refresh --all')
    process.exit(1)
  }
  
  if (!manager.hasAccount(targetEmail)) {
    logError(`Account '${targetEmail}' not found.`)
    process.exit(1)
  }
  
  console.log(`\n🔄 Refreshing ${targetEmail}...`)
  
  try {
    const tokenManager = getTokenManagerForAccount(targetEmail)
    
    if (!tokenManager.isTokenExpired()) {
      info(`Token for ${targetEmail} is still valid.`)
      return
    }
    
    await tokenManager.refreshToken()
    resetTokenManager()
    success(`\n✅ Token refreshed for ${targetEmail}`)
  } catch (err) {
    logError(`\n❌ Failed to refresh token: ${err instanceof Error ? err.message : 'Unknown error'}`)
    info('\nThe refresh token may be expired. Please re-authenticate:')
    info(`  antigravity-usage accounts switch ${targetEmail}`)
    info('  antigravity-usage login')
    process.exit(1)
  }
}

/**
 * Main accounts command handler - dispatches to subcommands
 */
export async function accountsCommand(
  subcommand: string,
  args: string[],
  options: { refresh?: boolean; force?: boolean; all?: boolean }
): Promise<void> {
  switch (subcommand) {
    case 'list':
      listAccountsCommand({ refresh: options.refresh })
      break
      
    case 'add':
      await addAccountCommand()
      break
      
    case 'switch':
      if (!args[0]) {
        logError('Please specify an account email to switch to.')
        console.log('Usage: antigravity-usage accounts switch <email>')
        process.exit(1)
      }
      switchAccountCommand(args[0])
      break
      
    case 'remove':
      if (!args[0]) {
        logError('Please specify an account email to remove.')
        console.log('Usage: antigravity-usage accounts remove <email>')
        process.exit(1)
      }
      removeAccountCommand(args[0], { force: options.force })
      break
      
    case 'current':
      currentAccountCommand()
      break
      
    case 'refresh':
      await refreshAccountCommand(args[0], { all: options.all })
      break
      
    default:
      // Default to list if no subcommand
      listAccountsCommand({ refresh: options.refresh })
  }
}
