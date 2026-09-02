/**
 * Types and JSON Schema definitions for Antigravity Usage configuration and settings
 */

export type StatusBarDisplayMode = 'compact' | 'detailed' | 'model-tag' | 'minimal'
export type AppTheme = 'dark' | 'light' | 'system'

export interface AppSettings {
  $schema?: string
  defaultModel: string
  statusBarDisplayMode: StatusBarDisplayMode
  autoSyncTranscripts: boolean
  syncIntervalMinutes: number
  tokenWarningThreshold: number
  autoWakeupEnabled: boolean
  wakeupSchedule: string
  showAutocompleteModels: boolean
  theme: AppTheme
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  $schema: './settings.schema.json',
  defaultModel: 'gemini-3.7-flash',
  statusBarDisplayMode: 'detailed',
  autoSyncTranscripts: true,
  syncIntervalMinutes: 15,
  tokenWarningThreshold: 100000,
  autoWakeupEnabled: true,
  wakeupSchedule: '0 9 * * *',
  showAutocompleteModels: false,
  theme: 'dark'
}

/**
 * Offline JSON Schema specification for in-editor autocomplete and validation in settings.json
 */
export const SETTINGS_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Antigravity Usage Settings',
  description: 'Configuration for Antigravity Usage, quota tracking, agent token analytics, and estimation',
  type: 'object',
  properties: {
    $schema: {
      type: 'string',
      description: 'URI to the settings schema for validation'
    },
    defaultModel: {
      type: 'string',
      description: 'Default target model used for pre-execution token usage and tool call estimation',
      enum: [
        'gemini-3.7-flash',
        'gemini-2.5-flash',
        'gemini-3.7-pro',
        'gemini-2.5-pro',
        'claude-3-7-sonnet',
        'claude-3-5-sonnet',
        'gpt-4o',
        'deepseek-r1',
        'gemma-2'
      ],
      default: 'gemini-3.7-flash'
    },
    statusBarDisplayMode: {
      type: 'string',
      description: 'Format of the badge displayed in the IDE bottom status bar',
      enum: ['compact', 'detailed', 'model-tag', 'minimal'],
      default: 'detailed'
    },
    autoSyncTranscripts: {
      type: 'boolean',
      description: 'Automatically discover and index agent conversation transcripts in the background',
      default: true
    },
    syncIntervalMinutes: {
      type: 'number',
      description: 'Interval in minutes between automatic brain transcript synchronization cycles',
      minimum: 1,
      maximum: 1440,
      default: 15
    },
    tokenWarningThreshold: {
      type: 'number',
      description: 'Estimated token threshold that triggers a warning badge highlight in the status bar',
      minimum: 1000,
      maximum: 2000000,
      default: 100000
    },
    autoWakeupEnabled: {
      type: 'boolean',
      description: 'Enable scheduled auto wake-up daemon to keep AI model quotas warm',
      default: true
    },
    wakeupSchedule: {
      type: 'string',
      description: 'Cron schedule expression for auto wake-up daemon (e.g. "0 9 * * *")',
      default: '0 9 * * *'
    },
    showAutocompleteModels: {
      type: 'boolean',
      description: 'Show autocomplete and secondary models in quota outputs by default',
      default: false
    },
    theme: {
      type: 'string',
      description: 'Visual theme for the web settings dashboard',
      enum: ['dark', 'light', 'system'],
      default: 'dark'
    }
  },
  required: [
    'defaultModel',
    'statusBarDisplayMode',
    'autoSyncTranscripts',
    'syncIntervalMinutes',
    'tokenWarningThreshold'
  ],
  additionalProperties: false
}
