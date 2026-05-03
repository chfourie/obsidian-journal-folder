import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App, Plugin } from 'obsidian'
import { PluginFeatureSet } from '../../src/plugin/plugin-feature-set'
import { PluginFeature } from '../../src/data-access/plugin-feature'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../src/data-access/journal-folder-settings.type'

class RecordingFeature extends PluginFeature {
  loaded = 0
  unloaded = 0
  externalChanges = 0
  receivedSettings: JournalFolderSettings[] = []

  constructor(plugin: Plugin) {
    super(plugin)
  }

  async load(): Promise<void> {
    this.loaded++
  }

  unload(): void {
    this.unloaded++
  }

  onExternalSettingsChange(): void {
    this.externalChanges++
  }

  useSettings(settings: JournalFolderSettings): void {
    super.useSettings(settings)
    this.receivedSettings.push(settings)
  }
}

class ThrowingFeature extends PluginFeature {
  constructor(plugin: Plugin) {
    super(plugin)
  }

  async load(): Promise<void> {
    throw new Error('load boom')
  }

  unload(): void {
    throw new Error('unload boom')
  }

  onExternalSettingsChange(): void {
    throw new Error('external boom')
  }

  useSettings(_settings: JournalFolderSettings): void {
    throw new Error('settings boom')
  }
}

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

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('PluginFeatureSet', () => {
  it('addFeature returns the same set so calls can be chained', () => {
    const set = new PluginFeatureSet()
    const result = set
      .addFeature(new RecordingFeature(makePlugin()))
      .addFeature(new RecordingFeature(makePlugin()))
    expect(result).toBe(set)
  })

  it('load() invokes load on every feature', async () => {
    const a = new RecordingFeature(makePlugin())
    const b = new RecordingFeature(makePlugin())
    const set = new PluginFeatureSet().addFeature(a).addFeature(b)

    await set.load()

    expect(a.loaded).toBe(1)
    expect(b.loaded).toBe(1)
  })

  it('load() catches errors and continues with subsequent features', async () => {
    const ok = new RecordingFeature(makePlugin())
    const bad = new ThrowingFeature(makePlugin())
    const set = new PluginFeatureSet().addFeature(bad).addFeature(ok)

    await expect(set.load()).resolves.toBeUndefined()
    expect(ok.loaded).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('unload() invokes unload on every feature', () => {
    const a = new RecordingFeature(makePlugin())
    const b = new RecordingFeature(makePlugin())
    const set = new PluginFeatureSet().addFeature(a).addFeature(b)

    set.unload()

    expect(a.unloaded).toBe(1)
    expect(b.unloaded).toBe(1)
  })

  it('unload() catches errors and continues with subsequent features', () => {
    const ok = new RecordingFeature(makePlugin())
    const bad = new ThrowingFeature(makePlugin())
    const set = new PluginFeatureSet().addFeature(bad).addFeature(ok)

    expect(() => set.unload()).not.toThrow()
    expect(ok.unloaded).toBe(1)
  })

  it('useSettings() passes a CLONE of the settings to each feature', () => {
    const a = new RecordingFeature(makePlugin())
    const b = new RecordingFeature(makePlugin())
    const set = new PluginFeatureSet().addFeature(a).addFeature(b)

    set.useSettings(DEFAULT_SETTINGS)

    expect(a.receivedSettings).toHaveLength(1)
    expect(b.receivedSettings).toHaveLength(1)
    // Each feature must receive an equal-but-distinct copy so mutations
    // in one feature do not bleed into another.
    expect(a.receivedSettings[0]).toEqual(DEFAULT_SETTINGS)
    expect(a.receivedSettings[0]).not.toBe(DEFAULT_SETTINGS)
    expect(a.receivedSettings[0]).not.toBe(b.receivedSettings[0])
  })

  it('useSettings() catches per-feature errors and still propagates to the rest', () => {
    const ok = new RecordingFeature(makePlugin())
    const bad = new ThrowingFeature(makePlugin())
    const set = new PluginFeatureSet().addFeature(bad).addFeature(ok)

    expect(() => set.useSettings(DEFAULT_SETTINGS)).not.toThrow()
    expect(ok.receivedSettings).toHaveLength(1)
  })

  it('onExternalSettingsChange() fans out and catches errors', () => {
    const ok = new RecordingFeature(makePlugin())
    const bad = new ThrowingFeature(makePlugin())
    const set = new PluginFeatureSet().addFeature(bad).addFeature(ok)

    expect(() => set.onExternalSettingsChange()).not.toThrow()
    expect(ok.externalChanges).toBe(1)
  })
})
