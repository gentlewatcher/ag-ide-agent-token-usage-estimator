/**
 * Windows Task Scheduler integration for auto wake-up
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { debug } from '../core/logger.js'
import type { CronInstallResult, CronStatus } from './types.js'

const execAsync = promisify(exec)
const TASK_NAME = 'AntigravityUsageWakeup'

/**
 * Install Windows Scheduled Task
 */
export async function installWindowsTask(cronExpression: string): Promise<CronInstallResult> {
  debug('windows-scheduler', `Installing Windows scheduled task for expression: ${cronExpression}`)

  try {
    // Uninstall existing task first if present
    await uninstallWindowsTask()

    // Determine trigger interval or daily time
    // cron format: minute hour day month weekday
    const parts = cronExpression.trim().split(/\s+/)
    const minute = parts[0] || '0'
    const hour = parts[1] || '*'

    let triggerScript = ''
    if (hour.startsWith('*/')) {
      const intervalHours = parseInt(hour.substring(2), 10) || 6
      triggerScript = `$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours ${intervalHours}) -RepetitionDuration ([TimeSpan]::MaxValue)`
    } else if (hour === '*' || hour === '0') {
      triggerScript = `$trigger = New-ScheduledTaskTrigger -Daily -At '${minute.padStart(2, '0')}:00'`
    } else {
      const firstHour = hour.split(',')[0]
      triggerScript = `$trigger = New-ScheduledTaskTrigger -Daily -At '${firstHour.padStart(2, '0')}:${minute.padStart(2, '0')}'`
    }

    const actionScript = `$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c antigravity-usage wakeup trigger --scheduled'`
    const registerScript = `Register-ScheduledTask -TaskName '${TASK_NAME}' -Description 'Antigravity model quota auto wakeup daemon' -Trigger $trigger -Action $action -Force`

    const fullCommand = `powershell -NoProfile -Command "${triggerScript}; ${actionScript}; ${registerScript}"`
    debug('windows-scheduler', `Executing command: ${fullCommand}`)

    const { stdout, stderr } = await execAsync(fullCommand)
    debug('windows-scheduler', `Task registered: ${stdout} ${stderr}`)

    return {
      success: true,
      cronExpression
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    debug('windows-scheduler', 'Failed to register Windows scheduled task', err)
    return {
      success: false,
      error: errorMsg,
      manualInstructions: `To manually register on Windows, open PowerShell as Administrator and run:\nRegister-ScheduledTask -TaskName "${TASK_NAME}" -Action (New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c antigravity-usage wakeup trigger --scheduled') -Trigger (New-ScheduledTaskTrigger -Daily -At 09:00)`
    }
  }
}

/**
 * Uninstall Windows Scheduled Task
 */
export async function uninstallWindowsTask(): Promise<boolean> {
  try {
    const cmd = `powershell -NoProfile -Command "if (Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName '${TASK_NAME}' -Confirm:\\$false }"`
    await execAsync(cmd)
    debug('windows-scheduler', 'Uninstalled Windows scheduled task')
    return true
  } catch (err) {
    debug('windows-scheduler', 'Error uninstalling task', err)
    return false
  }
}

/**
 * Check if Windows task is installed
 */
export async function isWindowsTaskInstalled(): Promise<boolean> {
  try {
    const cmd = `powershell -NoProfile -Command "if (Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue) { Write-Output 'INSTALLED' }"`
    const { stdout } = await execAsync(cmd)
    return stdout.includes('INSTALLED')
  } catch {
    return false
  }
}

/**
 * Get status of Windows task
 */
export async function getWindowsTaskStatus(): Promise<CronStatus> {
  try {
    const isInstalled = await isWindowsTaskInstalled()
    if (!isInstalled) {
      return { installed: false }
    }

    const infoCmd = `powershell -NoProfile -Command "$task = Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue; if ($task) { ($task | Get-ScheduledTaskInfo).NextRunTime.ToString('yyyy-MM-dd HH:mm:ss') }"`
    const { stdout } = await execAsync(infoCmd)
    const nextRun = stdout.trim()

    return {
      installed: true,
      nextRun: nextRun || 'Scheduled via Windows Task Scheduler'
    }
  } catch {
    return { installed: false }
  }
}
