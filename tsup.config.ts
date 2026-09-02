import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node20',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    dts: true,
    banner: {
      js: '#!/usr/bin/env node'
    },
    shims: true
  },
  {
    entry: { extension: 'src/extension.ts' },
    format: ['esm', 'cjs'],
    target: 'node20',
    outDir: 'dist',
    clean: false,
    sourcemap: true,
    external: ['vscode'],
    shims: true
  }
])
