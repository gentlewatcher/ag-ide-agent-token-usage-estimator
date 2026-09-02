/**
 * Script to build, clean old installed extension versions, and deploy fresh extension into Antigravity IDE
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

export interface DeployOptions {
  cleanOnly?: boolean
  skipBuild?: boolean
}

export function deployExtension(options: DeployOptions = {}): void {
  console.log('🚀 [Antigravity Extension Deployer] Starting clean extension deployment...')

  // 1. Build project if not skipped
  if (!options.skipBuild && !options.cleanOnly) {
    console.log('📦 Building project bundles with tsup...')
    execSync('npm run build', { cwd: rootDir, stdio: 'inherit' })
  }

  // 2. Locate Antigravity extensions directory
  const homeDir = os.homedir()
  const extensionsDir = path.join(homeDir, '.antigravity-ide', 'extensions')

  if (!fs.existsSync(extensionsDir)) {
    console.log(`📁 Creating extensions directory: ${extensionsDir}`)
    fs.mkdirSync(extensionsDir, { recursive: true })
  }

  // 3. Read package.json for metadata
  const pkgJsonPath = path.join(rootDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
  const version = pkg.version || '1.0.0'
  const publisher = pkg.publisher || 'zenpasha'
  const extensionName = pkg.name || 'ag-ide-agent-token-usage-estimator'
  const targetFolderName = `${publisher}.${extensionName}-${version}-universal`
  const targetExtDir = path.join(extensionsDir, targetFolderName)

  // 4. Find and remove all existing/old versions of our extension
  const existingItems = fs.readdirSync(extensionsDir)
  for (const item of existingItems) {
    if (item.startsWith(`${publisher}.${extensionName}`) || item.startsWith('zenpasha.antigravity-usage')) {
      const fullPath = path.join(extensionsDir, item)
      console.log(`🧹 Removing old installed extension version: ${item}`)
      try {
        fs.rmSync(fullPath, { recursive: true, force: true })
      } catch (err) {
        console.warn(`⚠️ Warning removing ${item}:`, err)
      }
    }
  }

  if (options.cleanOnly) {
    console.log('✨ Clean operation finished.')
    return
  }

  // 5. Create fresh target folder
  console.log(`📂 Creating target installation directory: ${targetFolderName}`)
  fs.mkdirSync(targetExtDir, { recursive: true })

  // 6. Copy files
  const filesToCopy = ['package.json', '.vsixmanifest', 'README.md', 'LICENSE']
  for (const file of filesToCopy) {
    const src = path.join(rootDir, file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetExtDir, file))
    }
  }

  // Copy extension.cjs as extension.js at root for native VS Code loader
  const cjsSrc = path.join(rootDir, 'dist', 'extension.cjs')
  if (fs.existsSync(cjsSrc)) {
    fs.copyFileSync(cjsSrc, path.join(targetExtDir, 'extension.js'))
  }

  // Copy dist directory
  const distSrc = path.join(rootDir, 'dist')
  const distDest = path.join(targetExtDir, 'dist')
  if (fs.existsSync(distSrc)) {
    fs.cpSync(distSrc, distDest, { recursive: true })
  }

  // 7. Update extensions.json
  const extensionsJsonPath = path.join(extensionsDir, 'extensions.json')
  let extList: any[] = []
  if (fs.existsSync(extensionsJsonPath)) {
    try {
      const content = fs.readFileSync(extensionsJsonPath, 'utf-8')
      extList = JSON.parse(content)
    } catch {
      extList = []
    }
  }

  // Filter out any old entries for this extension
  extList = extList.filter(
    e => e?.identifier?.id !== `${publisher}.${extensionName}` && e?.identifier?.id !== 'zenpasha.antigravity-usage'
  )

  // Add fresh entry
  const now = Date.now()
  const newEntry = {
    identifier: {
      id: `${publisher}.${extensionName}`,
      uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    },
    version: version,
    location: {
      $mid: 1,
      path: `/${targetExtDir.replace(/\\/g, '/')}`,
      scheme: 'file'
    },
    relativeLocation: targetFolderName,
    metadata: {
      installedTimestamp: now,
      pinned: false,
      source: 'gallery',
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      publisherId: publisher,
      publisherDisplayName: publisher,
      targetPlatform: 'universal',
      updated: true,
      private: false,
      isPreReleaseVersion: false,
      hasPreReleaseVersion: false
    }
  }

  extList.push(newEntry)
  fs.writeFileSync(extensionsJsonPath, JSON.stringify(extList), 'utf-8')

  console.log(`✅ [Success] Cleaned and deployed ${extensionName} v${version} to Antigravity IDE!`)
  console.log(`📍 Extension path: ${targetExtDir}`)
  console.log('🔄 Reload Antigravity IDE window (Ctrl+Shift+P -> Developer: Reload Window) to activate!')
}

// Run if called directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  deployExtension()
}
