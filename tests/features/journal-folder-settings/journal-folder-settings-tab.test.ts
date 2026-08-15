/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { describe, expect, it, vi } from 'vitest'
import {
  JournalFolderSettingsTab,
  buildGlobalSettingDefinitions,
  scaffoldTemplateFiles,
  type GlobalSettingsDeps,
} from '../../../src/features/journal-folder-settings/journal-folder-settings-tab'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
  MIGRATION_REFERENCE_PRESETS,
} from '../../../src/data-access'
import {
  App,
  Plugin,
  Setting,
  SettingPage,
  TextComponent,
  type PluginManifest,
} from 'obsidian'

// The declarative definition shapes the tests traverse. Structural (not
// imported from 'obsidian') because the mock module doesn't re-export the
// real type declarations.
type AnyDefinition = {
  type?: string
  name?: string
  heading?: string
  items?: AnyDefinition[]
  control?: { key: string; type: string; [k: string]: unknown }
  render?: (setting: Setting, group: unknown) => void
  page?: () => SettingPage
  visible?: boolean | (() => boolean)
}

function makeStore(overrides: Partial<JournalFolderSettings> = {}) {
  let settings: JournalFolderSettings = { ...DEFAULT_SETTINGS, ...overrides }
  const saveSettings = vi.fn(async (next: JournalFolderSettings) => {
    settings = next
  })
  return {
    getCurrentSettings: () => settings,
    saveSettings,
  }
}

function makeTab(overrides: Partial<JournalFolderSettings> = {}) {
  const store = makeStore(overrides)
  const app = new App()
  const plugin = new Plugin(app, { id: 'journal-folder' } as PluginManifest)
  const tab = new JournalFolderSettingsTab(
    plugin,
    store.getCurrentSettings,
    store.saveSettings
  )
  return { tab, store }
}

function makeDeps(overrides: Partial<JournalFolderSettings> = {}): {
  deps: GlobalSettingsDeps
  store: ReturnType<typeof makeStore>
} {
  const store = makeStore(overrides)
  return {
    deps: {
      app: new App(),
      getCurrentSettings: store.getCurrentSettings,
      saveSettings: store.saveSettings,
      requestRerender: vi.fn(),
    },
    store,
  }
}

function flatten(items: AnyDefinition[]): AnyDefinition[] {
  return items.flatMap((item) => [
    item,
    ...flatten(item.items ?? []),
  ])
}

function findByName(items: AnyDefinition[], name: string): AnyDefinition {
  const match = flatten(items).find((d) => d.name === name)
  if (!match) throw new Error(`No definition named "${name}"`)
  return match
}

function isVisible(def: AnyDefinition): boolean {
  if (typeof def.visible === 'function') return def.visible()
  return def.visible !== false
}

describe('JournalFolderSettingsTab (declarative)', () => {
  describe('getSettingDefinitions', () => {
    it('returns a non-empty declarative definition tree', () => {
      const { tab } = makeTab()
      const defs = tab.getSettingDefinitions() as AnyDefinition[]
      expect(defs.length).toBeGreaterThan(0)
    })

    it('binds every control key to a known settings field', () => {
      const { tab } = makeTab()
      const defs = tab.getSettingDefinitions() as AnyDefinition[]
      const controls = flatten(defs).filter((d) => d.control)
      expect(controls.length).toBeGreaterThan(10)
      for (const def of controls) {
        expect(
          def.control!.key in DEFAULT_SETTINGS,
          `control key "${def.control!.key}" is not a settings field`
        ).toBe(true)
      }
    })

    it('exposes the expected top-level sections', () => {
      const { tab } = makeTab()
      const defs = tab.getSettingDefinitions() as AnyDefinition[]
      const headings = defs.map((d) => d.heading).filter(Boolean)
      expect(headings).toEqual(
        expect.arrayContaining(['General', 'Sidebar', 'Today', 'Calendar', 'Reset'])
      )
      const pages = defs.filter((d) => d.type === 'page').map((d) => d.name)
      expect(pages).toEqual(
        expect.arrayContaining([
          'New-note template',
          'Note title patterns',
          'Tasks',
          'Signifiers',
        ])
      )
    })

    it('names every definition so settings search can index it', () => {
      const { tab } = makeTab()
      const defs = tab.getSettingDefinitions() as AnyDefinition[]
      for (const def of flatten(defs)) {
        if (def.type === 'group' || def.type === 'list') continue
        expect(def.name, JSON.stringify(def)).toBeTruthy()
      }
    })
  })

  describe('visibility predicates', () => {
    it('hides the folder title while the folder name is used as title', () => {
      const { tab, store } = makeTab({ useFolderNameAsDefaultTitle: false })
      const defs = tab.getSettingDefinitions() as AnyDefinition[]
      const title = findByName(defs, 'Default journal folder title')
      expect(isVisible(title)).toBe(true)
      void store.saveSettings({
        ...store.getCurrentSettings(),
        useFolderNameAsDefaultTitle: true,
      })
      expect(isVisible(title)).toBe(false)
    })

    it('gates the quarterly pattern tier on quartersEnabled', () => {
      const { tab, store } = makeTab({ quartersEnabled: false })
      const defs = tab.getSettingDefinitions() as AnyDefinition[]
      const quarterly = flatten(defs).find(
        (d) => d.heading === 'Quarterly notes'
      )!
      expect(quarterly).toBeDefined()
      expect(isVisible(quarterly)).toBe(false)
      void store.saveSettings({
        ...store.getCurrentSettings(),
        quartersEnabled: true,
      })
      expect(isVisible(quarterly)).toBe(true)
    })

    it('shows the migration heading fields only for heading placement', () => {
      const { tab, store } = makeTab({ taskMigrationPlacement: 'after-last-task' })
      const defs = tab.getSettingDefinitions() as AnyDefinition[]
      const heading = findByName(defs, 'Migration heading')
      const level = findByName(defs, 'Migration heading level')
      expect(isVisible(heading)).toBe(false)
      expect(isVisible(level)).toBe(false)
      void store.saveSettings({
        ...store.getCurrentSettings(),
        taskMigrationPlacement: 'heading',
      })
      expect(isVisible(heading)).toBe(true)
      expect(isVisible(level)).toBe(true)
    })

    it('gates template fields on autoTemplateEnabled', () => {
      const { tab, store } = makeTab({ autoTemplateEnabled: false })
      const defs = tab.getSettingDefinitions() as AnyDefinition[]
      const folder = findByName(defs, 'Template folder')
      expect(isVisible(folder)).toBe(false)
      void store.saveSettings({
        ...store.getCurrentSettings(),
        autoTemplateEnabled: true,
      })
      expect(isVisible(folder)).toBe(true)
    })

    it('hides the reference style and opacity while both references are off', () => {
      const { tab, store } = makeTab({
        taskMigrationAddToReference: false,
        taskMigrationAddFromReference: false,
      })
      const defs = tab.getSettingDefinitions() as AnyDefinition[]
      const style = findByName(defs, 'Reference style')
      const toMarker = findByName(defs, 'Migrated-to marker')
      expect(isVisible(style)).toBe(false)
      expect(isVisible(toMarker)).toBe(false)
      void store.saveSettings({
        ...store.getCurrentSettings(),
        taskMigrationAddToReference: true,
      })
      expect(isVisible(style)).toBe(true)
      expect(isVisible(toMarker)).toBe(true)
    })
  })

  describe('getControlValue', () => {
    it('reads the current settings value', () => {
      const { tab } = makeTab({ journalFolderTitle: 'Journal' })
      expect(tab.getControlValue('journalFolderTitle')).toBe('Journal')
      expect(tab.getControlValue('quartersEnabled')).toBe(false)
    })

    it('stringifies the heading level for its dropdown', () => {
      const { tab } = makeTab({ taskMigrationHeadingLevel: 3 })
      expect(tab.getControlValue('taskMigrationHeadingLevel')).toBe('3')
    })
  })

  describe('setControlValue', () => {
    it('persists a plain value', async () => {
      const { tab, store } = makeTab()
      await tab.setControlValue('journalFolderTitle', 'My Journal')
      expect(store.getCurrentSettings().journalFolderTitle).toBe('My Journal')
      expect(store.saveSettings).toHaveBeenCalledTimes(1)
    })

    it('coerces the heading level back to a number', async () => {
      const { tab, store } = makeTab()
      await tab.setControlValue('taskMigrationHeadingLevel', '4')
      expect(store.getCurrentSettings().taskMigrationHeadingLevel).toBe(4)
    })

    it('falls back to "Tasks" for an empty migration heading', async () => {
      const { tab, store } = makeTab()
      await tab.setControlValue('taskMigrationHeading', '   ')
      expect(store.getCurrentSettings().taskMigrationHeading).toBe('Tasks')
    })

    it('clears the folder title when the folder-name toggle turns on', async () => {
      const { tab, store } = makeTab({ journalFolderTitle: 'Journal' })
      await tab.setControlValue('useFolderNameAsDefaultTitle', true)
      const settings = store.getCurrentSettings()
      expect(settings.useFolderNameAsDefaultTitle).toBe(true)
      expect(settings.journalFolderTitle).toBe('')
    })

    it('reseeds both markers when the reference style changes', async () => {
      const { tab, store } = makeTab()
      await tab.setControlValue('taskMigrationReferenceStyle', 'emoji')
      const settings = store.getCurrentSettings()
      expect(settings.taskMigrationReferenceStyle).toBe('emoji')
      expect(settings.taskMigrationToMarker).toBe(
        MIGRATION_REFERENCE_PRESETS.emoji.to
      )
      expect(settings.taskMigrationFromMarker).toBe(
        MIGRATION_REFERENCE_PRESETS.emoji.from
      )
    })
  })

  describe('render definitions', () => {
    it('renders a moment pattern field with its e2e hook and persists edits', () => {
      const { deps, store } = makeDeps()
      const defs = buildGlobalSettingDefinitions(deps) as AnyDefinition[]
      const daily = flatten(defs).filter(
        (d) => d.render && d.name === 'Title pattern'
      )[0]
      const host = document.createElement('div')
      const setting = new Setting(host)
      daily.render!(setting, {})
      expect(setting.settingEl.dataset.jfSetting).toBe('dailyNoteTitlePattern')
      const moment = setting.components.find(
        (c) => c instanceof TextComponent
      ) as TextComponent
      moment.trigger('YYYY [day] DDD')
      expect(store.getCurrentSettings().dailyNoteTitlePattern).toBe(
        'YYYY [day] DDD'
      )
      // The sample row lands directly below the setting row.
      expect(
        setting.settingEl.nextElementSibling?.classList.contains(
          'journal-folder-config-hints-row'
        )
      ).toBe(true)
    })

    it('renders a migration marker input that persists edits', () => {
      const { deps, store } = makeDeps({
        taskMigrationAddToReference: true,
      })
      const defs = buildGlobalSettingDefinitions(deps) as AnyDefinition[]
      const marker = findByName(defs, 'Migrated-to marker')
      const host = document.createElement('div')
      const setting = new Setting(host)
      marker.render!(setting, {})
      const text = setting.components.find(
        (c) => c instanceof TextComponent
      ) as TextComponent
      text.trigger('⇒')
      expect(store.getCurrentSettings().taskMigrationToMarker).toBe('⇒')
    })

    it('offers a destructive reset control', () => {
      const { deps } = makeDeps()
      const defs = buildGlobalSettingDefinitions(deps) as AnyDefinition[]
      const reset = findByName(defs, 'Reset all to default values')
      const host = document.createElement('div')
      const setting = new Setting(host)
      reset.render!(setting, {})
      expect(setting.controlEl.querySelector('button.mod-destructive')).not.toBeNull()
    })
  })

  describe('imperative sub-pages', () => {
    it('mounts the task-flows page with its overview and stable page hook', () => {
      const { deps } = makeDeps()
      const defs = buildGlobalSettingDefinitions(deps) as AnyDefinition[]
      const flows = findByName(defs, 'Task flows')
      const page = flows.page!()
      page.display()
      expect(page.containerEl.getAttribute('data-jf-settings-page')).toBe(
        'task-flows'
      )
      expect(page.containerEl.textContent).toContain('Default flow')
    })

    it('mounts the signifiers page with its add affordance', () => {
      const { deps } = makeDeps()
      const defs = buildGlobalSettingDefinitions(deps) as AnyDefinition[]
      const signifiers = findByName(defs, 'Signifiers')
      const page = signifiers.page!()
      page.display()
      expect(page.containerEl.getAttribute('data-jf-settings-page')).toBe(
        'signifiers'
      )
      expect(
        page.containerEl.querySelector('[data-jf-add-signifier]')
      ).not.toBeNull()
    })

    it('mounts the task-categories page with its add affordance', () => {
      const { deps } = makeDeps()
      const defs = buildGlobalSettingDefinitions(deps) as AnyDefinition[]
      const categories = findByName(defs, 'Task categories')
      const page = categories.page!()
      page.display()
      expect(
        page.containerEl.querySelector('[data-jf-add-category]')
      ).not.toBeNull()
    })
  })
})

describe('scaffoldTemplateFiles', () => {
  function makeApp(existingPaths: string[] = []) {
    const app = new App()
    const created: string[] = []
    app.vault.getAbstractFileByPath = ((path: string) =>
      existingPaths.includes(path) ? ({ path } as never) : null) as never
    app.vault.create = (async (path: string) => {
      created.push(path)
      return { path } as never
    }) as never
    app.vault.createFolder = (async () => ({}) as never) as never
    return { app, created }
  }

  it('creates the standard tier templates plus the default fallback', async () => {
    const { app, created } = makeApp()
    const written = await scaffoldTemplateFiles(app, {
      ...DEFAULT_SETTINGS,
      templateFolder: 'templates',
      quartersEnabled: false,
    })
    expect(written).toBe(5)
    expect(created).toEqual([
      'templates/daily-template.md',
      'templates/weekly-template.md',
      'templates/monthly-template.md',
      'templates/yearly-template.md',
      'templates/default-template.md',
    ])
  })

  it('includes the quarterly template when quarters are enabled', async () => {
    const { app, created } = makeApp()
    const written = await scaffoldTemplateFiles(app, {
      ...DEFAULT_SETTINGS,
      templateFolder: 'templates',
      quartersEnabled: true,
    })
    expect(written).toBe(6)
    expect(created).toContain('templates/quarterly-template.md')
  })

  it('skips files that already exist', async () => {
    const { app, created } = makeApp(['templates/daily-template.md'])
    const written = await scaffoldTemplateFiles(app, {
      ...DEFAULT_SETTINGS,
      templateFolder: 'templates',
      quartersEnabled: false,
    })
    expect(written).toBe(4)
    expect(created).not.toContain('templates/daily-template.md')
  })

  it('does nothing without a template folder', async () => {
    const { app, created } = makeApp()
    const written = await scaffoldTemplateFiles(app, {
      ...DEFAULT_SETTINGS,
      templateFolder: '',
    })
    expect(written).toBe(0)
    expect(created).toEqual([])
  })
})
