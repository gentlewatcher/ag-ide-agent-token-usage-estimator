/**
 * antigravity-usage CLI entry point
 */

import { Command } from 'commander'
import { version } from './version'
import { setDebugMode } from './core/logger.js'

// Import commands
import { loginCommand } from './commands/login.js'
import { logoutCommand } from './commands/logout.js'
import { statusCommand } from './commands/status.js'
import { quotaCommand } from './commands/quota.js'
import { doctorCommand } from './commands/doctor.js'
import { accountsCommand } from './commands/accounts.js'

const program = new Command()

program
  .name('antigravity-usage')
  .description('CLI tool to check Antigravity model quota via Google Cloud Code API')
  .version(version)
  .option('--debug', 'Enable debug mode')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts()
    if (opts.debug) {
      setDebugMode(true)
    }
  })

// Login command
program
  .command('login')
  .description('Authenticate with Google (adds a new account)')
  .option('--no-browser', 'Do not open browser, print URL instead')
  .option('--manual', 'Manual login flow (copy-paste URL)')
  .option('-p, --port <port>', 'Port for OAuth callback server', parseInt)
  .action(loginCommand)

// Logout command
program
  .command('logout [email]')
  .description('Remove stored credentials')
  .option('--all', 'Logout from all accounts')
  .action((email, options) => logoutCommand(options, email))

// Status command
program
  .command('status')
  .description('Show current authentication status')
  .option('--all', 'Show status for all accounts')
  .option('-a, --account <email>', 'Show status for specific account')
  .action(statusCommand)

// Quota command (default)
program
  .command('quota', { isDefault: true })
  .description('Fetch and display quota information')
  .option('--json', 'Output as JSON')
  .option('-m, --method <method>', 'Method to use: auto (default), local, or google', 'auto')
  .option('--all', 'Show quota for all accounts')
  .option('-a, --account <email>', 'Show quota for specific account')
  .option('--refresh', 'Force refresh (ignore cache)')
  .option('--all-models', 'Include autocomplete models (Gemini 2.5) in quota display')
  .action(quotaCommand)

// Accounts command with subcommands
const accountsCmd = program
  .command('accounts')
  .description('Manage multiple accounts')

accountsCmd
  .command('list')
  .description('List all accounts')
  .option('--refresh', 'Show refresh tip')
  .action((options) => accountsCommand('list', [], options))

accountsCmd
  .command('add')
  .description('Add a new account (triggers OAuth login)')
  .action(() => accountsCommand('add', [], {}))

accountsCmd
  .command('switch <email>')
  .description('Switch to a different account')
  .action((email) => accountsCommand('switch', [email], {}))

accountsCmd
  .command('remove <email>')
  .description('Remove an account')
  .option('--force', 'Skip confirmation')
  .action((email, options) => accountsCommand('remove', [email], options))

accountsCmd
  .command('current')
  .description('Show current active account')
  .action(() => accountsCommand('current', [], {}))

accountsCmd
  .command('refresh [email]')
  .description('Refresh account tokens')
  .option('--all', 'Refresh all accounts')
  .action((email, options) => accountsCommand('refresh', email ? [email] : [], options))

// Default action for accounts command (show list)
accountsCmd.action(() => accountsCommand('list', [], {}))

// Doctor command
program
  .command('doctor')
  .description('Run diagnostics and show configuration')
  .action(doctorCommand)

// Agent command with subcommands
import { agentCommand } from './commands/agent.js'

const agentCmd = program
  .command('agent')
  .description('Track Antigravity Agent token usage and session statistics')
  .option('--json', 'Output as JSON')
  .option('-l, --limit <n>', 'Limit number of sessions to analyze', '20')
  .option('-s, --since <time>', 'Filter time window (e.g. 1d, 7d, 30d, all)')
  .option('--session <id>', 'Inspect specific conversation ID')
  .action((options) => agentCommand(undefined, undefined, options))

agentCmd
  .command('summary')
  .description('Display summary overview of agent token usage')
  .option('--json', 'Output as JSON')
  .option('-l, --limit <n>', 'Limit number of recent sessions to show', '10')
  .option('-s, --since <time>', 'Filter time window (e.g. 1d, 7d, 30d, all)')
  .action((options) => agentCommand('summary', undefined, options))

agentCmd
  .command('sessions')
  .description('List agent conversation sessions with token metrics')
  .option('--json', 'Output as JSON')
  .option('-l, --limit <n>', 'Limit number of sessions to list', '20')
  .option('-s, --since <time>', 'Filter time window (e.g. 1d, 7d, 30d, all)')
  .action((options) => agentCommand('sessions', undefined, options))

agentCmd
  .command('session <conversationId>')
  .description('Inspect detailed step-by-step breakdown of a specific conversation')
  .option('--json', 'Output as JSON')
  .action((conversationId, options) => agentCommand('session', conversationId, options))

agentCmd
  .command('models')
  .description('Display token consumption by model')
  .option('--json', 'Output as JSON')
  .option('-s, --since <time>', 'Filter time window (e.g. 1d, 7d, 30d, all)')
  .action((options) => agentCommand('models', undefined, options))

// Estimate command
import { estimateCommand } from './commands/estimate.js'

const estimateCmd = program
  .command('estimate')
  .description('Predict estimated token usage and tool calls for prompts and implementation plans')
  .option('-p, --prompt <text>', 'Prompt text to analyze and estimate')
  .option('--plan <path>', 'Path to implementation_plan.md to analyze')
  .option('-m, --model <modelId>', 'Target model for cross-model ratio scaling (e.g. gemini-3.7-pro, claude-3-7-sonnet)')
  .option('--badge', 'Output compact bottom status bar badge')
  .option('--sync', 'Sync and index historical brain artifacts')
  .option('--ratios', 'Display cross-model statistical ratio matrix')
  .option('--json', 'Output full estimation payload as JSON')
  .action((options) => estimateCommand({
    prompt: options.prompt,
    planPath: options.plan,
    model: options.model,
    badge: options.badge,
    sync: options.sync,
    ratios: options.ratios,
    json: options.json
  }))

estimateCmd
  .command('ratios')
  .description('Display learned cross-model statistical scaling ratios')
  .option('--json', 'Output as JSON')
  .action((options) => estimateCommand({ ratios: true, json: options.json }))

// Wakeup command with subcommands
import { wakeupCommand } from './commands/wakeup.js'

const wakeupCmd = program
  .command('wakeup')
  .description('Auto wake-up and warm up AI models')

wakeupCmd
  .command('config')
  .description('Configure auto wake-up schedule')
  .action(() => wakeupCommand('config', [], {}))

wakeupCmd
  .command('trigger')
  .description('Execute one trigger cycle (called by cron)')
  .option('--scheduled', 'Mark as scheduled trigger')
  .action((options) => wakeupCommand('trigger', [], options))

wakeupCmd
  .command('install')
  .description('Install wake-up schedule to system cron')
  .action(() => wakeupCommand('install', [], {}))

wakeupCmd
  .command('uninstall')
  .description('Remove wake-up schedule from system cron')
  .action(() => wakeupCommand('uninstall', [], {}))

wakeupCmd
  .command('test')
  .description('Test trigger manually')
  .option('-e, --email <email>', 'Account email to use for testing')
  .option('-m, --model <model>', 'Model ID to test')
  .option('-p, --prompt <prompt>', 'Test prompt to send', 'hi')
  .action((options) => wakeupCommand('test', [], options))

wakeupCmd
  .command('history')
  .description('View trigger history')
  .option('--limit <n>', 'Number of records to show', '10')
  .option('--json', 'Output as JSON')
  .action((options) => wakeupCommand('history', [], options))

wakeupCmd
  .command('status')
  .description('Show wake-up status and configuration')
  .action(() => wakeupCommand('status', [], {}))

// Settings command
import { settingsCommand } from './commands/settings.js'

program
  .command('settings')
  .description('Open settings in editor tab or launch interactive web dashboard')
  .option('-o, --open', 'Open settings.json directly in IDE editor with schema autocomplete')
  .option('-w, --web', 'Launch local glassmorphic settings dashboard in browser')
  .option('-p, --port <port>', 'Custom port for settings web server', '3840')
  .option('--json', 'Output current settings as JSON')
  .action((options) => settingsCommand(options))

// Config command
import { configCommand } from './commands/config.js'

const configCmd = program
  .command('config')
  .description('Inspect or modify configuration key-value settings')
  .option('--json', 'Output as JSON')

configCmd
  .command('get [key]')
  .description('Get a configuration value')
  .option('--json', 'Output as JSON')
  .action((key, options) => configCommand('get', key, undefined, options))

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .option('--json', 'Output as JSON')
  .action((key, value, options) => configCommand('set', key, value, options))

configCmd
  .command('list')
  .description('List all configuration values')
  .option('--json', 'Output as JSON')
  .action((options) => configCommand('list', undefined, undefined, options))

configCmd
  .command('open')
  .description('Open settings.json file directly in IDE editor')
  .action(() => configCommand('open'))

configCmd
  .command('reset')
  .description('Reset settings back to defaults')
  .option('--json', 'Output as JSON')
  .action((options) => configCommand('reset', undefined, undefined, options))

// Default action for config command (list)
configCmd.action((options) => configCommand('list', undefined, undefined, options))

// Menu command
import { menuCommand } from './commands/menu.js'

program
  .command('menu')
  .description('Launch interactive bottom bar QuickPick menu or output context menu schema')
  .option('--json', 'Output status bar context menu JSON schema for IDE integration')
  .option('-x, --execute <actionId>', 'Directly execute a menu action ID')
  .action((options) => menuCommand(options))

// Extension deployment & cleaning command
import { extensionCommand } from './commands/extension.js'

const extCmd = program
  .command('extension')
  .description('Manage, clean, or deploy the Antigravity IDE Status Bar extension')
  .option('--clean', 'Remove old installed extension versions from Antigravity IDE')
  .option('--deploy', 'Build and deploy the latest extension into Antigravity IDE')
  .option('--skip-build', 'Skip building dist bundles before deploying')
  .action((options) => extensionCommand(undefined, options))

extCmd
  .command('deploy')
  .description('Build and deploy the latest extension into Antigravity IDE')
  .option('--skip-build', 'Skip building dist bundles before deploying')
  .action((options) => extensionCommand('deploy', options))

extCmd
  .command('clean')
  .description('Remove all installed versions of this extension from Antigravity IDE')
  .action(() => extensionCommand('clean', { clean: true }))

// Parse and run
program.parse()

