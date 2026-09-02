/**
 * Tests for global configuration management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock the env module before importing config
const testDir = join(tmpdir(), 'antigravity-config-test-' + Date.now())

vi.mock('../../src/core/env.js', () => ({
  getConfigDir: () => testDir,
  getAccountsDir: () => join(testDir, 'accounts'),
  getAccountDir: (email: string) => join(testDir, 'accounts', email),
  getGlobalConfigPath: () => join(testDir, 'config.json'),
  getTokensPath: () => join(testDir, 'tokens.json')
}))

// Import after mocking
import {
  loadConfig,
  saveConfig,
  getActiveAccountEmail,
  setActiveAccountEmail,
  getCacheTTL
} from '../../src/accounts/config.js'
import { DEFAULT_CONFIG } from '../../src/accounts/types.js'

describe('accounts/config', () => {
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

  describe('loadConfig', () => {
    it('should return default config when no config file exists', () => {
      const config = loadConfig()
      
      expect(config.version).toBe(DEFAULT_CONFIG.version)
      expect(config.activeAccount).toBe(null)
      expect(config.preferences.cacheTTL).toBe(300)
    })
  })

  describe('saveConfig / loadConfig', () => {
    it('should save and load config', () => {
      const config = {
        version: '2.0',
        activeAccount: 'test@example.com',
        preferences: {
          cacheTTL: 600
        }
      }
      
      saveConfig(config)
      const loaded = loadConfig()
      
      expect(loaded.activeAccount).toBe('test@example.com')
      expect(loaded.preferences.cacheTTL).toBe(600)
    })
  })

  describe('getActiveAccountEmail / setActiveAccountEmail', () => {
    it('should get and set active account', () => {
      expect(getActiveAccountEmail()).toBe(null)
      
      setActiveAccountEmail('user@example.com')
      expect(getActiveAccountEmail()).toBe('user@example.com')
      
      setActiveAccountEmail('other@example.com')
      expect(getActiveAccountEmail()).toBe('other@example.com')
      
      setActiveAccountEmail(null)
      expect(getActiveAccountEmail()).toBe(null)
    })
  })

  describe('getCacheTTL', () => {
    it('should return default cache TTL', () => {
      expect(getCacheTTL()).toBe(300)
    })

    it('should return configured cache TTL', () => {
      const config = loadConfig()
      config.preferences.cacheTTL = 120
      saveConfig(config)
      
      expect(getCacheTTL()).toBe(120)
    })
  })
})
