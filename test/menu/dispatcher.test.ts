import { describe, it, expect } from 'vitest'
import { getStatusBarContextMenuDefinitions, STATUS_BAR_MENU_ITEMS } from '../../src/menu/dispatcher.js'

describe('Bottom Bar Context Menu Dispatcher', () => {
  it('exports valid menu item definitions for IDE integration', () => {
    const items = getStatusBarContextMenuDefinitions()
    expect(items.length).toBeGreaterThan(5)

    const ids = items.map(i => i.id)
    expect(ids).toContain('open-settings-editor')
    expect(ids).toContain('open-settings-web')
    expect(ids).toContain('estimate-plan')
    expect(ids).toContain('model-ratios')
    expect(ids).toContain('agent-analytics')
    expect(ids).toContain('sync-brain')
    expect(ids).toContain('wakeup-trigger')

    for (const item of STATUS_BAR_MENU_ITEMS) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('label')
      expect(item).toHaveProperty('command')
      expect(item).toHaveProperty('description')
    }
  })
})
