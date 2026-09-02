/**
 * Tests for account storage operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, rmSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock the env module before importing storage
const testDir = join(tmpdir(), 'antigravity-usage-test-' + Date.now())

vi.mock('../../src/core/env.js', () => ({
  getConfigDir: () => testDir,
  getAccountsDir: () => join(testDir, 'accounts'),
  getAccountDir: (email: string) => join(testDir, 'accounts', email),
  getGlobalConfigPath: () => join(testDir, 'config.json'),
  getTokensPath: () => join(testDir, 'tokens.json')
}))

// Import after mocking
import {
  ensureAccountsDir,
  ensureAccountDir,
  accountExists,
  listAccountEmails,
  saveAccountTokens,
  loadAccountTokens,
  saveAccountMetadata,
  loadAccountMetadata,
  deleteAccount
} from '../../src/accounts/storage.js'
import type { StoredTokens } from '../../src/quota/types.js'
import type { AccountMetadata } from '../../src/accounts/types.js'

describe('accounts/storage', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('ensureAccountsDir', () => {
    it('should create accounts directory if it does not exist', () => {
      ensureAccountsDir()
      expect(existsSync(join(testDir, 'accounts'))).toBe(true)
    })
  })

  describe('ensureAccountDir', () => {
    it('should create account directory', () => {
      ensureAccountDir('test@example.com')
      expect(existsSync(join(testDir, 'accounts', 'test@example.com'))).toBe(true)
    })
  })

  describe('accountExists', () => {
    it('should return false for non-existent account', () => {
      expect(accountExists('nonexistent@example.com')).toBe(false)
    })

    it('should return true for existing account with tokens', () => {
      const tokens: StoredTokens = {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000,
        email: 'test@example.com'
      }
      saveAccountTokens('test@example.com', tokens)
      expect(accountExists('test@example.com')).toBe(true)
    })
  })

  describe('listAccountEmails', () => {
    it('should return empty array when no accounts exist', () => {
      expect(listAccountEmails()).toEqual([])
    })

    it('should return list of account emails', () => {
      const tokens: StoredTokens = {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000
      }
      
      saveAccountTokens('user1@example.com', tokens)
      saveAccountTokens('user2@example.com', tokens)
      
      const emails = listAccountEmails()
      expect(emails).toContain('user1@example.com')
      expect(emails).toContain('user2@example.com')
      expect(emails.length).toBe(2)
    })
  })

  describe('saveAccountTokens / loadAccountTokens', () => {
    it('should save and load tokens', () => {
      const tokens: StoredTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        email: 'test@example.com',
        projectId: 'test-project'
      }
      
      saveAccountTokens('test@example.com', tokens)
      const loaded = loadAccountTokens('test@example.com')
      
      expect(loaded).not.toBeNull()
      expect(loaded?.accessToken).toBe('test-access-token')
      expect(loaded?.refreshToken).toBe('test-refresh-token')
      expect(loaded?.email).toBe('test@example.com')
      expect(loaded?.projectId).toBe('test-project')
    })

    it('should return null for non-existent account', () => {
      expect(loadAccountTokens('nonexistent@example.com')).toBeNull()
    })
  })

  describe('saveAccountMetadata / loadAccountMetadata', () => {
    it('should save and load metadata', () => {
      const metadata: AccountMetadata = {
        email: 'test@example.com',
        addedAt: '2026-01-15T10:00:00Z',
        lastUsed: '2026-01-15T11:00:00Z'
      }
      
      saveAccountMetadata('test@example.com', metadata)
      const loaded = loadAccountMetadata('test@example.com')
      
      expect(loaded).not.toBeNull()
      expect(loaded?.email).toBe('test@example.com')
      expect(loaded?.addedAt).toBe('2026-01-15T10:00:00Z')
      expect(loaded?.lastUsed).toBe('2026-01-15T11:00:00Z')
    })
  })

  describe('deleteAccount', () => {
    it('should delete account directory', () => {
      const tokens: StoredTokens = {
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000
      }
      saveAccountTokens('test@example.com', tokens)
      
      expect(accountExists('test@example.com')).toBe(true)
      
      const deleted = deleteAccount('test@example.com')
      
      expect(deleted).toBe(true)
      expect(accountExists('test@example.com')).toBe(false)
    })

    it('should return false for non-existent account', () => {
      expect(deleteAccount('nonexistent@example.com')).toBe(false)
    })
  })
})
