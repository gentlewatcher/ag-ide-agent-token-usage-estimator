/**
 * Deployment script runner
 */

import { deployExtension } from '../src/extension/deployer.js'

const cleanOnly = process.argv.includes('--clean')
const skipBuild = process.argv.includes('--skip-build')

deployExtension({ cleanOnly, skipBuild })
