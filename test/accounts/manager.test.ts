/**
 * Tests for account manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock the env module before importing manager
const testDir = join(tmpdir(), 'antigravity-manager-test-' + Date.now())

vi.mock('../../src/core/env.js', () => ({
  getConfigDir: () => testDir,
  getAccountsDir: () => join(testDir, 'accounts'),
  getAccountDir: (email: string) => join(testDir, 'accounts', email),
  getGlobalConfigPath: () => join(testDir, 'config.json'),
  getTokensPath: () => join(testDir, 'tokens.json')
}))

// Import after mocking
import { AccountManager, getAccountManager } from '../../src/accounts/manager.js'
import type { StoredTokens } from '../../src/quota/types.js'

const createTestTokens = (email: string): StoredTokens => ({
  accessToken: `access-${email}`,
  refreshToken: `refresh-${email}`,
  expiresAt: Date.now() + 3600000, // 1 hour from now
  email
})

describe('accounts/manager', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
    // Reset the manager singleton
    AccountManager.resetInstance()
  })

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    AccountManager.resetInstance()
  })

  describe('getAccountManager', () => {
    it('should return singleton instance', () => {
      const manager1 = getAccountManager()
      const manager2 = getAccountManager()
      expect(manager1).toBe(manager2)
    })
  })

  describe('addAccount', () => {
    it('should add a new account', () => {
      const manager = getAccountManager()
      const tokens = createTestTokens('test@example.com')
      
      manager.addAccount(tokens, 'test@example.com')
      
      expect(manager.hasAccount('test@example.com')).toBe(true)
      expect(manager.getActiveEmail()).toBe('test@example.com')
    })

    it('should set first account as active', () => {
      const manager = getAccountManager()
      
      manager.addAccount(createTestTokens('first@example.com'), 'first@example.com')
      expect(manager.getActiveEmail()).toBe('first@example.com')
      
      manager.addAccount(createTestTokens('second@example.com'), 'second@example.com')
      // Second account is set as active after add (per current implementation)
      expect(manager.getActiveEmail()).toBe('second@example.com')
    })
  })

  describe('getAccountEmails', () => {
    it('should return empty array when no accounts', () => {
      const manager = getAccountManager()
      expect(manager.getAccountEmails()).toEqual([])
    })

    it('should return list of account emails', () => {
      const manager = getAccountManager()
      manager.addAccount(createTestTokens('user1@example.com'), 'user1@example.com')
      manager.addAccount(createTestTokens('user2@example.com'), 'user2@example.com')
      
      const emails = manager.getAccountEmails()
      expect(emails).toContain('user1@example.com')
      expect(emails).toContain('user2@example.com')
    })
  })

  describe('setActiveAccount', () => {
    it('should switch active account', () => {
      const manager = getAccountManager()
      manager.addAccount(createTestTokens('first@example.com'), 'first@example.com')
      manager.addAccount(createTestTokens('second@example.com'), 'second@example.com')
      
      const switched = manager.setActiveAccount('first@example.com')
      
      expect(switched).toBe(true)
      expect(manager.getActiveEmail()).toBe('first@example.com')
    })

    it('should return false for non-existent account', () => {
      const manager = getAccountManager()
      const switched = manager.setActiveAccount('nonexistent@example.com')
      expect(switched).toBe(false)
    })
  })

  describe('removeAccount', () => {
    it('should remove an account', () => {
      const manager = getAccountManager()
      manager.addAccount(createTestTokens('test@example.com'), 'test@example.com')
      
      expect(manager.hasAccount('test@example.com')).toBe(true)
      
      const removed = manager.removeAccount('test@example.com')
      
      expect(removed).toBe(true)
      expect(manager.hasAccount('test@example.com')).toBe(false)
    })

    it('should set next account as active when removing active', () => {
      const manager = getAccountManager()
      manager.addAccount(createTestTokens('first@example.com'), 'first@example.com')
      manager.addAccount(createTestTokens('second@example.com'), 'second@example.com')
      manager.setActiveAccount('first@example.com')
      
      manager.removeAccount('first@example.com')
      
      expect(manager.getActiveEmail()).toBe('second@example.com')
    })
  })

  describe('removeAllAccounts', () => {
    it('should remove all accounts', () => {
      const manager = getAccountManager()
      manager.addAccount(createTestTokens('user1@example.com'), 'user1@example.com')
      manager.addAccount(createTestTokens('user2@example.com'), 'user2@example.com')
      
      const count = manager.removeAllAccounts()
      
      expect(count).toBe(2)
      expect(manager.getAccountEmails()).toEqual([])
      expect(manager.getActiveEmail()).toBeNull()
    })
  })

  describe('getAccountStatus', () => {
    it('should return valid for fresh tokens', () => {
      const manager = getAccountManager()
      manager.addAccount(createTestTokens('test@example.com'), 'test@example.com')
      
      expect(manager.getAccountStatus('test@example.com')).toBe('valid')
    })

    it('should return expired for old tokens', () => {
      const manager = getAccountManager()
      const tokens: StoredTokens = {
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: Date.now() - 1000, // Expired
        email: 'test@example.com'
      }
      manager.addAccount(tokens, 'test@example.com')
      
      expect(manager.getAccountStatus('test@example.com')).toBe('expired')
    })

    it('should return invalid for non-existent account', () => {
      const manager = getAccountManager()
      expect(manager.getAccountStatus('nonexistent@example.com')).toBe('invalid')
    })
  })

  describe('getAccountSummaries', () => {
    it('should return summaries for all accounts', () => {
      const manager = getAccountManager()
      manager.addAccount(createTestTokens('user1@example.com'), 'user1@example.com')
      manager.addAccount(createTestTokens('user2@example.com'), 'user2@example.com')
      manager.setActiveAccount('user1@example.com')
      
      const summaries = manager.getAccountSummaries()
      
      expect(summaries.length).toBe(2)
      
      const user1 = summaries.find(s => s.email === 'user1@example.com')
      expect(user1).toBeDefined()
      expect(user1?.isActive).toBe(true)
      expect(user1?.status).toBe('valid')
      
      const user2 = summaries.find(s => s.email === 'user2@example.com')
      expect(user2).toBeDefined()
      expect(user2?.isActive).toBe(false)
    })
  })
})
