/**
 * Accounts module exports
 */

// Types
export * from './types.js'

// Storage operations
export {
  ensureAccountsDir,
  ensureAccountDir,
  accountExists,
  listAccountEmails,
  saveAccountTokens,
  loadAccountTokens,
  saveAccountMetadata,
  loadAccountMetadata,
  updateLastUsed,
  saveAccountCache,
  loadAccountCache,
  deleteAccountCache,
  deleteAccount
} from './storage.js'

// Config operations 
export {
  loadConfig,
  saveConfig,
  getActiveAccountEmail,
  setActiveAccountEmail,
  getCacheTTL
} from './config.js'

// Cache operations
export {
  isCacheValid,
  getCacheAge,
  saveCache,
  loadCache,
  loadCacheWithMeta,
  invalidateCache
} from './cache.js'

// Manager
export { 
  AccountManager, 
  getAccountManager 
} from './manager.js'
