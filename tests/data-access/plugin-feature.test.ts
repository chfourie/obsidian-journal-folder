import { describe, expect, it } from 'vitest'
import { App, Plugin, type TFile } from 'obsidian'
import { PluginFeature } from '../../src/data-access/plugin-feature'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../src/data-access/journal-folder-settings.type'
import { buildApp } from '../helpers/fixtures'

class ProbeFeature extends PluginFeature {
  constructor(plugin: Plugin) {
    super(plugin)
  }

  // Expose protected helpers for testing.
  publicGlobalSettings(): JournalFolderSettings {
    return this.globalSettings
  }
  publicGetSettings(file: TFile | null = null, embedded = ''): JournalFolderSettings {
    return this.getSettings(file, embedded)
  }
}

function makePlugin(app: App): Plugin {
  return new Plugin(app, {
    id: 'test',
    name: 'Test',
    version: '0.0.0',
    minAppVersion: '0.0.0',
    description: '',
    author: '',
  })
}

describe('PluginFeature', () => {
  it('starts with DEFAULT_SETTINGS', () => {
    const feature = new ProbeFeature(makePlugin(new App()))
    expect(feature.publicGlobalSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('useSettings replaces the global settings', () => {
    const feature = new ProbeFeature(makePlugin(new App()))
    feature.useSettings({ ...DEFAULT_SETTINGS, journalFolderTitle: 'Hi' })
    expect(feature.publicGlobalSettings().journalFolderTitle).toBe('Hi')
  })

  it('getSettings overlays folder front-matter on globals', () => {
    const { app, files } = buildApp('Journal', [
      '2026-05-03',
      {
        name: 'journal-folder.md',
        frontmatter: { 'journal-folder-title': 'From Folder' },
      },
    ])
    const feature = new ProbeFeature(makePlugin(app))

    const resolved = feature.publicGetSettings(files['2026-05-03'])

    expect(resolved.journalFolderTitle).toBe('From Folder')
  })

  it('getSettings overlays embedded config on top of folder + globals', () => {
    const { app, files } = buildApp('Journal', [
      '2026-05-03',
      {
        name: 'journal-folder.md',
        frontmatter: { 'journal-folder-title': 'From Folder' },
      },
    ])
    const feature = new ProbeFeature(makePlugin(app))

    const resolved = feature.publicGetSettings(
      files['2026-05-03'],
      'journal-folder-title: From Embed'
    )

    expect(resolved.journalFolderTitle).toBe('From Embed')
  })
})
