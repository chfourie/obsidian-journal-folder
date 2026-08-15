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

import { type App, setIcon, Setting, SettingGroup } from 'obsidian'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
  type TaskMigrationPlacement,
} from '../../data-access'
import { renderFolderTaskFlowSection } from './task-flow-editor'
import {
  attachMomentSetting,
  attachTextSetting,
  buildPatternsIntroFragment,
  LEVEL_OPTIONS,
  MIGRATION_HEADING_DESC,
  MIGRATION_LEVEL_DESC,
  PATTERN_TIERS,
  PLACEMENT_DESC,
  PLACEMENT_LABELS,
  type SettingsStringFieldName,
} from './journal-folder-settings-tab'

// Sentinel option value for the "inherit the global config" choice.
// Distinct from any real setting value.
const FOLDER_DEFAULT = '__jf_default__'

// The settings keys whose value is a plain scalar — the only fields the
// override dropdowns render (and the only ones safe to stringify into
// option values).
type ScalarSettingField = {
  [K in keyof JournalFolderSettings]: JournalFolderSettings[K] extends
    | string
    | number
    | boolean
    ? K
    : never
}[keyof JournalFolderSettings]

// Coerce a dropdown's string value back into the field's primitive type
// (booleans and numbers arrive as strings from the `<select>`). Mirrors
// the type carried by the field's `DEFAULT_SETTINGS` entry.
function coerceToFieldType(
  field: keyof JournalFolderSettings,
  value: string
): string | number | boolean {
  const sample = DEFAULT_SETTINGS[field]
  if (typeof sample === 'boolean') return value === 'true'
  if (typeof sample === 'number') return Number(value)
  return value
}

export type SettingsFormConfig = {
  app: App
  containerEl: HTMLElement
  getCurrentSettings: () => JournalFolderSettings
  saveSettings: (settings: JournalFolderSettings) => Promise<void>
  // `getGlobalSettings` is the config a folder inherits from;
  // `getOverriddenFields` is the set of camelCase field keys the folder
  // currently overrides (i.e. the keys present in its front matter).
  // Together they drive the per-field "Default" (inherit) choice the
  // folder modal offers for every overridable setting.
  getGlobalSettings?: () => JournalFolderSettings
  getOverriddenFields?: () => Set<string>
}

// Renders the per-folder settings form into the given container. Used by
// the per-folder config modal; the global plugin tab renders declaratively
// via `getSettingDefinitions()` instead. Skips global-only fields and the
// destructive Reset section, since those don't make sense per-folder.
//
// The layout mirrors the global tab's declarative look *and flow*: the
// root page holds native `SettingGroup` sections for the small groups
// (General / Today / Calendar) plus navigable entries — the same
// `.mod-navigable` rows the declarative renderer emits — that drill
// into sub-pages for the template, patterns, and tasks sections, each
// with the native `.setting-page-titlebar` back header. Only the
// controls differ, because every folder field carries the Default
// (inherit) choice.
//
// Re-renders in place when the user changes a field that alters the
// form's structure (`useFolderNameAsDefaultTitle`, `quartersEnabled`,
// `autoTemplateEnabled`, `taskMigrationPlacement`).
export function renderSettingsForm(config: SettingsFormConfig): void {
  new FolderSettingsFormBuilder(config).render()
}

// Sub-pages reachable from the root page's navigable entries.
type FolderPageId = 'root' | 'templates' | 'patterns' | 'tasks'

const PAGE_TITLES: Record<Exclude<FolderPageId, 'root'>, string> = {
  templates: 'New-note template',
  patterns: 'Note title patterns',
  tasks: 'Tasks',
}

class FolderSettingsFormBuilder {
  // The section currently being rendered. Field helpers all target
  // `this.containerEl`, which resolves to this while a section is drawn.
  private sectionEl: HTMLElement | null = null
  // Sticky across re-renders within a single open of the modal (the
  // builder is created once per open), so structural re-renders keep the
  // user on the sub-page they were editing.
  private activePage: FolderPageId = 'root'

  constructor(private config: SettingsFormConfig) {}

  private get containerEl(): HTMLElement {
    return this.sectionEl ?? this.config.containerEl
  }

  private readonly saveSettings = async (
    settings: JournalFolderSettings
  ): Promise<void> => {
    await this.config.saveSettings(settings)
  }

  private readonly getCurrentSettings = (): JournalFolderSettings => {
    return this.config.getCurrentSettings()
  }

  render(): void {
    const root = this.config.containerEl
    root.empty()
    // Stable hook for the e2e suite — which page the form is showing.
    root.setAttribute('data-jf-folder-page', this.activePage)

    const settings = { ...this.getCurrentSettings() }
    if (this.activePage === 'root') {
      this.renderGeneralSection(settings)
      this.renderTodaySection(settings)
      this.renderCalendarSection(settings)
      this.renderPageLinks()
    } else {
      this.renderPageTitlebar(PAGE_TITLES[this.activePage])
      if (this.activePage === 'templates') this.renderTemplatesSection(settings)
      else if (this.activePage === 'patterns') this.renderPatternsSection(settings)
      else this.renderTasksSection(settings)
    }
    this.sectionEl = null
  }

  // Open a native settings group (the same chrome the declarative global
  // tab renders) and route subsequent rows into it. Without a heading the
  // group is just the rounded card the declarative renderer draws around
  // ungrouped rows.
  private section(heading?: string): void {
    const group = new SettingGroup(this.config.containerEl)
    if (heading) group.setHeading(heading)
    this.sectionEl = group.listEl
  }

  // The root page's navigable entries — same rows the declarative global
  // tab renders for its sub-pages (`.mod-navigable` + chevron).
  private renderPageLinks(): void {
    this.section()
    this.pageLink(
      'templates',
      'Seed new journal notes from template notes.'
    )
    this.pageLink(
      'patterns',
      'Date format strings used to render note titles and links.'
    )
    this.pageLink('tasks', 'Folder task flow and migration placement.')
  }

  private pageLink(
    page: Exclude<FolderPageId, 'root'>,
    desc: string
  ): void {
    const setting = new Setting(this.containerEl)
      .setName(PAGE_TITLES[page])
      .setDesc(desc)
    setting.settingEl.addClass('mod-navigable', 'tappable')
    setting.settingEl.dataset.jfPageLink = page
    setting.settingEl.tabIndex = 0
    const chevron = setting.controlEl.createDiv({ cls: 'setting-item-chevron' })
    setIcon(chevron, 'chevron-right')
    const open = (): void => {
      this.activePage = page
      this.render()
    }
    setting.settingEl.addEventListener('click', open)
    setting.settingEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open()
      }
    })
  }

  // The native sub-page header: back chevron + page title, matching the
  // declarative renderer's `.setting-page-titlebar`.
  private renderPageTitlebar(title: string): void {
    const bar = this.config.containerEl.createDiv({
      cls: 'setting-page-titlebar',
    })
    const back = bar.createDiv({
      cls: ['clickable-icon', 'setting-page-back-button'],
    })
    back.setAttribute('data-jf-page-back', '')
    back.setAttribute('role', 'button')
    back.tabIndex = 0
    back.setAttribute('aria-label', 'Back')
    setIcon(back, 'chevron-left')
    const goBack = (): void => {
      this.activePage = 'root'
      this.render()
    }
    back.addEventListener('click', goBack)
    back.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        goBack()
      }
    })
    bar.createDiv({ cls: 'setting-page-title', text: title })
  }

  // A name + description row with no control — the folder form's
  // equivalent of the global tab's empty definitions.
  private infoRow(name: string, desc: string | DocumentFragment): void {
    new Setting(this.containerEl).setName(name).setDesc(desc)
  }

  // ---- sections -----------------------------------------------

  private renderGeneralSection(settings: JournalFolderSettings): void {
    this.section('General')
    this.createFolderBooleanOverride(
      settings,
      'useFolderNameAsDefaultTitle',
      'Use folder name as default folder title',
      'When on (and no folder title is set), the folder name is used as ' +
        'the journal folder title.',
      { rerender: true }
    )
    if (!settings.useFolderNameAsDefaultTitle) {
      this.createFolderTextOverride(
        settings,
        'journalFolderTitle',
        'Folder title',
        "Display title shown above the H1 in this folder's journal headers."
      )
    }
    this.createFolderBooleanOverride(
      settings,
      'quartersEnabled',
      'Enable quarterly notes',
      'Recognise "YYYY-Q[1-4]" notes as a quarterly tier between yearly ' +
        'and monthly.',
      { rerender: true }
    )
  }

  private renderTodaySection(settings: JournalFolderSettings): void {
    this.section('Today')
    this.createFolderBooleanOverride(
      settings,
      'includeInTodayPicker',
      'Include this folder in the Today picker',
      "Whether this folder participates in the plugin's Today action: " +
        'when the Today action has several eligible folders, it offers a ' +
        'folder only when this is on.'
    )
  }

  private renderCalendarSection(settings: JournalFolderSettings): void {
    this.section('Calendar')
    this.createFolderBooleanOverride(
      settings,
      'defaultCalendarVisibleDesktop',
      'Show calendar by default on desktop',
      'Whether the calendar picker is visible when Obsidian starts on ' +
        'desktop.'
    )
    this.createFolderBooleanOverride(
      settings,
      'defaultCalendarVisibleMobile',
      'Show calendar by default on mobile',
      'Whether the calendar picker is visible when Obsidian starts on ' +
        'mobile.'
    )
  }

  private renderTemplatesSection(settings: JournalFolderSettings): void {
    // Page title comes from the titlebar; the group is the headingless card.
    this.section()
    this.infoRow(
      'How templates work',
      "When enabled, newly created notes whose names match a journal " +
        "pattern (e.g. 2026-05-07, 2026-W19, 2026-05, 2026-Q2, 2026) and " +
        "that live in a folder containing a 'journal-folder.md' note are " +
        "seeded from a template note. Templates live as ordinary notes " +
        "with standardized names — daily-template.md, weekly-template.md, " +
        "monthly-template.md, quarterly-template.md, yearly-template.md, " +
        "and default-template.md as a fallback."
    )
    this.createFolderBooleanOverride(
      settings,
      'autoTemplateEnabled',
      'Auto-fill new journal notes',
      'Seed new journal notes in this folder from the matching template ' +
        'note.',
      { rerender: true }
    )
    if (!settings.autoTemplateEnabled) return

    // Template-folder paths are global-only. Per-folder overrides are
    // expressed by dropping files into the override subfolder, not via a
    // setting — so the folder modal only carries the enable toggle plus
    // this hint.
    this.infoRow(
      'Per-folder template overrides',
      `Drop standardized template notes (daily-template.md, ` +
        `monthly-template.md, …) into ` +
        `a '${settings.templateOverrideFolderName}' subfolder of this ` +
        `journal folder to override the global templates for this folder ` +
        `only. They take precedence over the global template folder.`
    )
  }

  private renderPatternsSection(settings: JournalFolderSettings): void {
    this.section()
    this.infoRow('Pattern syntax', buildPatternsIntroFragment())

    for (const tier of PATTERN_TIERS) {
      if (tier.quarterly && !settings.quartersEnabled) continue
      this.section(tier.heading)
      if (tier.note) this.infoRow(tier.note.name, tier.note.desc)
      for (const f of tier.fields) {
        this.createFolderTextOverride(settings, f.field, f.name, f.desc, {
          moment: true,
        })
      }
    }
  }

  private renderTasksSection(settings: JournalFolderSettings): void {
    this.section()
    this.infoRow(
      'Folder task flow',
      "The flow that drives this folder's task icons and cycles. " +
        'Flow contents are edited globally — pick "Use default" to ' +
        'inherit whatever the global default flow is at the time ' +
        'tasks render.'
    )
    renderFolderTaskFlowSection({
      containerEl: this.containerEl,
      getSettings: () => settings,
      saveSettings: (next) => this.saveSettings(next),
    })
    this.createMigrationPlacementSettings(settings)
  }

  // Migration placement is one of the few task fields a folder may
  // override (it's a per-note layout concern). The heading text / level
  // inputs only show when placement resolves to "Under a heading"; a
  // re-render toggles them as the dropdown changes. Each control offers
  // the inherit-global "Default" choice.
  createMigrationPlacementSettings(settings: JournalFolderSettings): void {
    this.createFolderEnumOverride(
      settings,
      'taskMigrationPlacement',
      'Migration placement',
      PLACEMENT_DESC,
      (Object.keys(PLACEMENT_LABELS) as TaskMigrationPlacement[]).map(
        (value) => ({ value, label: PLACEMENT_LABELS[value] })
      ),
      { rerender: true }
    )
    if (settings.taskMigrationPlacement === 'heading') {
      this.createFolderTextOverride(
        settings,
        'taskMigrationHeading',
        'Migration heading',
        MIGRATION_HEADING_DESC
      )
      this.createFolderEnumOverride(
        settings,
        'taskMigrationHeadingLevel',
        'Migration heading level',
        MIGRATION_LEVEL_DESC,
        LEVEL_OPTIONS
      )
    }
  }

  // ---- per-field "Default" overrides --------------------------
  //
  // Every overridable field can either inherit the global config
  // ("Default") or carry an explicit override. These helpers render that
  // choice. Picking "Default" is persisted by writing the *global* value
  // back, which `computeFrontMatterDiff` then drops from the folder's
  // front matter — so the folder transparently tracks future global
  // edits.
  //
  // Text fields gate a real input behind a Default/Custom dropdown. A
  // freshly-picked "Custom" whose value still equals global would be
  // dropped on save (indistinguishable from inheriting), so the chosen-
  // Custom fields are tracked here for the lifetime of the open modal —
  // keeping their input visible until the user types a diverging value.
  private folderCustomText = new Set<string>()

  private get folderGlobal(): JournalFolderSettings {
    return this.config.getGlobalSettings?.() ?? this.config.getCurrentSettings()
  }

  private isFolderOverride(field: keyof JournalFolderSettings): boolean {
    return this.config.getOverriddenFields?.().has(field) ?? false
  }

  private clearFolderOverride(
    settings: JournalFolderSettings,
    field: keyof JournalFolderSettings
  ): void {
    // Writing the global value makes the save-diff treat the field as
    // "same as global" and remove its front-matter key → inherit restored.
    ;(settings as Record<string, unknown>)[field] = this.folderGlobal[field]
  }

  // Single dropdown: "Default (<inherited>)" followed by each concrete
  // option. Selecting a concrete value writes an override; "Default"
  // clears it. `rerender` redraws the form after a change for fields that
  // show/hide dependent settings.
  private createFolderEnumOverride(
    settings: JournalFolderSettings,
    field: ScalarSettingField,
    name: string,
    desc: string,
    options: Array<{ value: string; label: string }>,
    opts: { rerender?: boolean } = {}
  ): Setting {
    const overridden = this.isFolderOverride(field)
    const globalValue = String(this.folderGlobal[field])
    const globalLabel =
      options.find((o) => o.value === globalValue)?.label ?? globalValue

    const onChange = async (raw: string) => {
      if (raw === FOLDER_DEFAULT) {
        this.clearFolderOverride(settings, field)
      } else {
        ;(settings as Record<string, unknown>)[field] = coerceToFieldType(
          field,
          raw
        )
      }
      await this.saveSettings(settings)
      if (opts.rerender) this.render()
    }

    const setting = new Setting(this.containerEl)
    setting.settingEl.dataset.jfSetting = field
    return setting
      .setName(name)
      .setDesc(desc)
      .addDropdown((dd) => {
        dd.addOption(FOLDER_DEFAULT, `Default (${globalLabel})`)
        for (const o of options) dd.addOption(o.value, o.label)
        dd.setValue(overridden ? String(settings[field]) : FOLDER_DEFAULT)
        dd.onChange(onChange)
      })
  }

  // Boolean field as Default / On / Off.
  private createFolderBooleanOverride(
    settings: JournalFolderSettings,
    field: ScalarSettingField,
    name: string,
    desc: string,
    opts: { rerender?: boolean } = {}
  ): Setting {
    return this.createFolderEnumOverride(
      settings,
      field,
      name,
      desc,
      [
        { value: 'true', label: 'On' },
        { value: 'false', label: 'Off' },
      ],
      opts
    )
  }

  // Text / moment field: a Default/Custom gate plus the real input,
  // shown only while "Custom" is selected.
  private createFolderTextOverride(
    settings: JournalFolderSettings,
    field: SettingsStringFieldName,
    name: string,
    desc: string,
    opts: { moment?: boolean } = {}
  ): void {
    const isCustom =
      this.isFolderOverride(field) || this.folderCustomText.has(field)
    const globalValue = String(this.folderGlobal[field])

    const onChange = async (raw: string) => {
      if (raw === 'custom') {
        this.folderCustomText.add(field)
        // Seed the input from the inherited value so the user edits from a
        // sensible starting point rather than an empty box.
        if (!this.isFolderOverride(field)) {
          settings[field] = this.folderGlobal[field]
        }
      } else {
        this.folderCustomText.delete(field)
        this.clearFolderOverride(settings, field)
        await this.saveSettings(settings)
      }
      this.render()
    }

    const setting = new Setting(this.containerEl)
    setting.settingEl.dataset.jfSetting = `${field}-mode`
    setting
      .setName(name)
      .setDesc(desc)
      .addDropdown((dd) => {
        dd.addOption(FOLDER_DEFAULT, `Default (${globalValue || '—'})`)
        dd.addOption('custom', 'Custom')
        dd.setValue(isCustom ? 'custom' : FOLDER_DEFAULT)
        dd.onChange(onChange)
      })

    if (isCustom) {
      const custom = new Setting(this.containerEl)
      // Stable hook for the e2e suite: target a field's control by its
      // settings key (`[data-jf-setting="dailyNoteTitlePattern"] input`).
      custom.settingEl.dataset.jfSetting = field
      custom.setName('Custom value')
      const cfg = {
        getCurrentSettings: this.getCurrentSettings,
        saveSettings: this.saveSettings,
      }
      if (opts.moment) {
        attachMomentSetting(custom, field, cfg)
      } else {
        attachTextSetting(custom, field, cfg)
      }
    }
  }
}
