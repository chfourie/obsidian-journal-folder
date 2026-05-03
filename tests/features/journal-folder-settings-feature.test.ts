import { describe, expect, it, vi } from 'vitest'
import { App, Plugin } from 'obsidian'
import { JournalFolderSettingsFeature } from '../../src/features/journal-folder-settings/journal-folder-settings-feature'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../src/data-access/journal-folder-settings.type'

function makePlugin(): Plugin {
  return new Plugin(new App(), {
    id: 'test',
    name: 'Test',
    version: '0.0.0',
    minAppVersion: '0.0.0',
    description: '',
    author: '',
  })
}

describe('JournalFolderSettingsFeature', () => {
  it('load() pulls saved data, merges with defaults, persists, and propagates', async () => {
    const plugin = makePlugin()
    plugin.loadData = vi.fn(async () => ({ journalFolderTitle: 'Stored' }))
    plugin.saveData = vi.fn(async () => {})
    plugin.addSettingTab = vi.fn()

    const propagated: JournalFolderSettings[] = []
    const feature = new JournalFolderSettingsFeature(plugin, (s) => {
      propagated.push(s)
    })

    await feature.load()

    // Stored value should override the default.
    expect((plugin.saveData as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      ...DEFAULT_SETTINGS,
      journalFolderTitle: 'Stored',
    })
    // The settings tab should have been registered.
    expect(plugin.addSettingTab).toHaveBeenCalledTimes(1)
    // The merged settings should have been propagated downstream.
    expect(propagated.at(-1)?.journalFolderTitle).toBe('Stored')
  })

  it('falls back to DEFAULT_SETTINGS when there is no stored data', async () => {
    const plugin = makePlugin()
    plugin.loadData = vi.fn(async () => null)
    plugin.saveData = vi.fn(async () => {})
    plugin.addSettingTab = vi.fn()

    const propagated: JournalFolderSettings[] = []
    const feature = new JournalFolderSettingsFeature(plugin, (s) => {
      propagated.push(s)
    })

    await feature.load()

    expect(propagated.at(-1)).toEqual(DEFAULT_SETTINGS)
  })

  it('onExternalSettingsChange re-pulls from storage and re-propagates', async () => {
    const plugin = makePlugin()
    let stored: Partial<JournalFolderSettings> | null = {
      journalFolderTitle: 'First',
    }
    plugin.loadData = vi.fn(async () => stored)
    plugin.saveData = vi.fn(async () => {})
    plugin.addSettingTab = vi.fn()

    const propagated: JournalFolderSettings[] = []
    const feature = new JournalFolderSettingsFeature(plugin, (s) => {
      propagated.push(s)
    })

    await feature.load()
    expect(propagated.at(-1)?.journalFolderTitle).toBe('First')

    // External change happens (e.g. settings file edited from another vault).
    stored = { journalFolderTitle: 'Second' }
    await feature.onExternalSettingsChange()

    expect(propagated.at(-1)?.journalFolderTitle).toBe('Second')
  })
})
