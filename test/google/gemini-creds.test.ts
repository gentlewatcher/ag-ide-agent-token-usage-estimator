import { describe, it, expect } from 'vitest'
import { loadNativeAntigravityTokens, getStorageInfo } from '../../src/google/storage.js'
import { getAntigravityOAuthCredsPath } from '../../src/core/env.js'

describe('Antigravity Native Credentials', () => {
  it('returns valid path for native credentials', () => {
    const credsPath = getAntigravityOAuthCredsPath()
    expect(credsPath).toContain('.gemini')
    expect(credsPath).toContain('oauth_creds.json')
  })

  it('provides storage info with native credentials status', () => {
    const storage = getStorageInfo()
    expect(storage).toHaveProperty('nativeCredsPath')
    expect(storage).toHaveProperty('nativeExists')
    expect(storage.nativeCredsPath).toContain('oauth_creds.json')
  })
})
