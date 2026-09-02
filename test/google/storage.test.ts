/**
 * Tests for token storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// We'll test the storage functions by temporarily modifying the env
// In real tests, you might want to mock the env module

describe('storage', () => {
  const testDir = join(tmpdir(), 'antigravity-usage-test-' + Date.now())
  
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

  it('should create test directory', () => {
    expect(existsSync(testDir)).toBe(true)
  })

  // Note: Full storage tests would require mocking the env module
  // to point to testDir. These are placeholder tests demonstrating
  // the test structure.
})
