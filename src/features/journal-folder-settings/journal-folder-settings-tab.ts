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

import {
  type App,
  ButtonComponent,
  debounce,
  Modal,
  type MomentFormatComponent,
  Notice,
  type Plugin,
  PluginSettingTab,
  setIcon,
  Setting,
  type SettingDefinition,
  type SettingDefinitionItem,
  type SettingGroupItem,
  SettingPage,
  type TextComponent,
} from 'obsidian'
import {
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATE_FILENAME,
  type JournalFolderSettings,
  type JournalTimeUnit,
  LUCIDE_MARKER_PREFIX,
  MIGRATION_REFERENCE_PRESETS,
  type StartOfWeekSetting,
  type TaskMigrationPlacement,
  type TaskMigrationReferenceStyle,
  TEMPLATE_FILENAMES,
} from '../../data-access'
import { DEFAULT_AUTO_TEMPLATE, ensureFolderExists } from '../journal-auto-template'
import {
  renderBreadcrumb,
  renderTaskFlowDetail,
  renderTaskFlowOverview,
} from './task-flow-editor'
import {
  renderStatusDetail,
  type StatusDetailSection,
} from './status-detail-editor'
import {
  renderCategoriesSection,
  renderSignifiersSection,
} from './signifier-category-editor'
import { EmojiPickerModal, LucidePickerModal } from './icon-pickers'

export const START_OF_WEEK_OPTIONS: Record<StartOfWeekSetting, string> = {
  'locale-default': 'Locale default',
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
}

export type SettingsStringFieldName =
  | 'dailyNoteTitlePattern'
  | 'dailyNoteShortTitlePattern'
  | 'weeklyNoteTitlePattern'
  | 'weeklyNoteShortTitlePattern'
  | 'monthlyNoteTitlePattern'
  | 'monthlyNoteShortTitlePattern'
  | 'quarterlyNoteTitlePattern'
  | 'quarterlyNoteShortTitlePattern'
  | 'quarterlyNoteMediumTitlePattern'
  | 'yearlyNoteTitlePattern'
  | 'yearlyNoteShortTitlePattern'
  | 'dailyNoteMediumTitlePattern'
  | 'weeklyNoteMediumTitlePattern'
  | 'monthlyNoteMediumTitlePattern'
  | 'yearlyNoteMediumTitlePattern'
  | 'journalFolderTitle'
  | 'templateFolder'
  | 'templateOverrideFolderName'
  | 'taskMigrationHeading'

// Shared copy for the task-migration placement controls — rendered
// declaratively in the global tab and as Default/Custom overrides in the
// per-folder form. One source keeps the two in step.
export const PLACEMENT_LABELS: Record<TaskMigrationPlacement, string> = {
  'after-last-task': 'After the last task',
  heading: 'Under a heading',
  top: 'Top of note',
  end: 'End of note',
}
export const LEVEL_OPTIONS = Array.from({ length: 6 }, (_, i) => ({
  value: String(i + 1),
  label: `Heading ${i + 1} (${'#'.repeat(i + 1)})`,
}))
export const PLACEMENT_DESC =
  'Where the task-migration commands insert copied tasks in the ' +
  'destination note.'
export const MIGRATION_HEADING_DESC =
  'Heading migrated tasks are placed under (matched ' +
  'case-insensitively; created at the level below if missing).'
export const MIGRATION_LEVEL_DESC =
  'Heading level used when the migration heading is created (H1–H6). ' +
  'Ignored when a heading of that text already exists — tasks then ' +
  'slot under it at its current level.'

// The note-title pattern fields, grouped by tier. Drives both the global
// declarative Patterns page and the per-folder override form.
export type PatternField = {
  field: SettingsStringFieldName
  name: string
  desc: string
}
export type PatternTier = {
  heading: string
  // Extra tier-level guidance rendered above the fields.
  note?: { name: string; desc: string }
  // Tier only exists while `quartersEnabled` is on.
  quarterly?: boolean
  fields: PatternField[]
}

const tierFields = (
  prefix: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  noun: string
): PatternField[] => {
  const fields: PatternField[] = [
    {
      field: `${prefix}NoteTitlePattern` as SettingsStringFieldName,
      name: 'Title pattern',
      desc: `Rendered as the title of a ${noun} note.`,
    },
    {
      field: `${prefix}NoteShortTitlePattern` as SettingsStringFieldName,
      name: 'Short link pattern',
      desc: `Used for compact in-line links to ${noun} notes.`,
    },
  ]
  if (prefix !== 'yearly') {
    fields.push({
      field: `${prefix}NoteMediumTitlePattern` as SettingsStringFieldName,
      name: 'Cross-year link pattern',
      desc: `Used for links to ${noun} notes that fall in a different year.`,
    })
  }
  return fields
}

export const PATTERN_TIERS: PatternTier[] = [
  { heading: 'Daily notes', fields: tierFields('daily', 'daily') },
  {
    heading: 'Weekly notes',
    note: {
      name: 'Week-year format',
      desc:
        "Use 'gg' or 'gggg' (not 'YY' / 'YYYY') for the year component so " +
        'it tracks the ISO/locale week year.',
    },
    fields: tierFields('weekly', 'weekly'),
  },
  { heading: 'Monthly notes', fields: tierFields('monthly', 'monthly') },
  {
    heading: 'Quarterly notes',
    quarterly: true,
    fields: tierFields('quarterly', 'quarterly'),
  },
  { heading: 'Yearly notes', fields: tierFields('yearly', 'yearly') },
]

export function buildPatternsIntroFragment(): DocumentFragment {
  const desc = activeWindow.createFragment()
  desc.append(
    'Date format strings used to render note titles and links. Each ' +
      "pattern should not render units shorter than its tier (e.g. don't " +
      'use day components in a monthly pattern). '
  )
  const link = activeWindow.createEl('a')
  link.href = 'https://momentjs.com/docs/#/displaying/format/'
  link.textContent = 'Pattern syntax reference'
  link.setAttribute('target', '_blank')
  link.setAttribute('rel', 'noopener')
  desc.append(link)
  desc.append('.')
  return desc
}

// ---- shared imperative field renderers ------------------------------
//
// Used by both the global tab (inside declarative `render` definitions)
// and the per-folder form (on Settings it constructs itself).

export type FieldRenderConfig = {
  getCurrentSettings: () => JournalFolderSettings
  saveSettings: (settings: JournalFolderSettings) => Promise<void>
}

export function attachTextSetting(
  setting: Setting,
  field: SettingsStringFieldName,
  cfg: FieldRenderConfig
): void {
  let component: TextComponent
  setting
    .addText((text) => {
      component = text
      const onChange = debounce(
        (value: string) => {
          const settings = { ...cfg.getCurrentSettings() }
          settings[field] = value
          // noinspection JSIgnoredPromiseFromCall
          void cfg.saveSettings(settings)
        },
        250,
        true
      )
      text.setValue(cfg.getCurrentSettings()[field]).onChange(onChange)
    })
    .addExtraButton((btn) => {
      btn
        .setIcon('reset')
        .setTooltip('Reset to default value')
        .onClick(() => {
          component.setValue(DEFAULT_SETTINGS[field])
          component.onChanged()
        })
    })
}

export function attachMomentSetting(
  setting: Setting,
  field: SettingsStringFieldName,
  cfg: FieldRenderConfig
): void {
  let component: MomentFormatComponent
  const sampleValueEl = activeWindow.createDiv()
  sampleValueEl.addClass('journal-folder-config-sample-value')

  setting
    .addMomentFormat((text) => {
      component = text
      const onChange = debounce(
        (value: string) => {
          const settings = { ...cfg.getCurrentSettings() }
          settings[field] = value
          // noinspection JSIgnoredPromiseFromCall
          void cfg.saveSettings(settings)
        },
        250,
        true
      )
      text.setDefaultFormat(DEFAULT_SETTINGS[field])
      text.setValue(cfg.getCurrentSettings()[field]).onChange(onChange)
      text.setSampleEl(sampleValueEl)
    })
    .addExtraButton((btn) => {
      btn
        .setIcon('reset')
        .setTooltip('Reset to default value')
        .onClick(() => {
          component.setValue(DEFAULT_SETTINGS[field])
          component.onChanged()
        })
    })

  const sampleEl = activeWindow.createDiv()
  sampleEl.addClass('journal-folder-config-hints-row')
  const sampleLabelEl = activeWindow.createDiv()
  sampleLabelEl.addClass('journal-folder-config-sample-label')
  sampleLabelEl.setText('Sample value:')
  sampleEl.appendChild(sampleLabelEl)
  sampleEl.appendChild(sampleValueEl)
  // A sibling row directly below the setting — matches the folder form's
  // layout, and sequential row rendering keeps it adjacent to its field.
  setting.settingEl.insertAdjacentElement('afterend', sampleEl)
}

// Creates any missing standardized template notes in the configured
// template folder, seeded with the built-in default body, so the user has
// files to edit instead of starting from scratch.
export async function scaffoldTemplateFiles(
  app: App,
  settings: JournalFolderSettings
): Promise<number> {
  const dir = settings.templateFolder.replace(/\/+$/, '')
  if (!dir) return 0
  await ensureFolderExists(app, dir)
  const tiers: JournalTimeUnit[] = settings.quartersEnabled
    ? ['day', 'week', 'month', 'quarter', 'year']
    : ['day', 'week', 'month', 'year']
  const names = [
    ...tiers.map((t) => `${TEMPLATE_FILENAMES[t]}.md`),
    `${DEFAULT_TEMPLATE_FILENAME}.md`,
  ]
  let written = 0
  for (const name of names) {
    const path = `${dir}/${name}`
    if (app.vault.getAbstractFileByPath(path)) continue
    try {
      await app.vault.create(path, DEFAULT_AUTO_TEMPLATE)
      written++
    } catch {
      // Best effort — skip on failure.
    }
  }
  return written
}

// ---- the settings tab (Obsidian ≥1.13 declarative API) --------------

// Control keys are the settings-type field names, so `getControlValue` /
// `setControlValue` can index `JournalFolderSettings` directly.
type SettingsKey = Extract<keyof JournalFolderSettings, string>

export type GlobalSettingsDeps = {
  app: App
  getCurrentSettings: () => JournalFolderSettings
  saveSettings: (settings: JournalFolderSettings) => Promise<void>
  // Ask the host tab to re-render (tab.update()) after a change that
  // alters rendered content beyond visible/disabled state.
  requestRerender: () => void
}

// Keys whose change alters rendered *content* (not just `visible` /
// `disabled` state) and therefore needs a full `update()` re-render:
// a style switch reseeds both marker inputs, quarters toggles the
// quarterly tier group + scaffold copy, and the folder-name toggle
// clears the title field.
const RERENDER_KEYS: ReadonlySet<string> = new Set([
  'useFolderNameAsDefaultTitle',
  'quartersEnabled',
  'taskMigrationReferenceStyle',
])

// Dropdown controls persist string option keys; these fields store numbers.
const NUMERIC_DROPDOWN_KEYS: ReadonlySet<string> = new Set([
  'taskMigrationHeadingLevel',
])

export class JournalFolderSettingsTab extends PluginSettingTab {
  constructor(
    private plugin: Plugin,
    private getCurrentSettings: () => JournalFolderSettings,
    private saveSettings: (settings: JournalFolderSettings) => Promise<void>
  ) {
    super(plugin.app, plugin)
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return buildGlobalSettingDefinitions({
      app: this.plugin.app,
      getCurrentSettings: this.getCurrentSettings,
      saveSettings: this.saveSettings,
      requestRerender: () => this.update(),
    })
  }

  getControlValue(key: string): unknown {
    const value = this.getCurrentSettings()[key as SettingsKey]
    return NUMERIC_DROPDOWN_KEYS.has(key) && typeof value === 'number'
      ? String(value)
      : value
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = { ...this.getCurrentSettings() }
    const record = settings as Record<string, unknown>
    if (NUMERIC_DROPDOWN_KEYS.has(key)) {
      record[key] = Number(value)
    } else if (key === 'taskMigrationHeading') {
      record[key] = String(value).trim() || 'Tasks'
    } else {
      record[key] = value
    }
    if (key === 'useFolderNameAsDefaultTitle' && value === true) {
      settings.journalFolderTitle = ''
    }
    if (key === 'taskMigrationReferenceStyle') {
      const style = value as TaskMigrationReferenceStyle
      settings.taskMigrationToMarker = MIGRATION_REFERENCE_PRESETS[style].to
      settings.taskMigrationFromMarker = MIGRATION_REFERENCE_PRESETS[style].from
    }
    await this.saveSettings(settings)
    if (RERENDER_KEYS.has(key)) {
      this.update()
    } else {
      this.refreshDomState()
    }
  }
}

export function buildGlobalSettingDefinitions(
  deps: GlobalSettingsDeps
): SettingDefinitionItem[] {
  const cur = deps.getCurrentSettings
  const fieldCfg: FieldRenderConfig = {
    getCurrentSettings: deps.getCurrentSettings,
    saveSettings: deps.saveSettings,
  }
  const anyMigrationReference = () =>
    cur().taskMigrationAddToReference || cur().taskMigrationAddFromReference

  const markerDefinition = (
    field: 'taskMigrationToMarker' | 'taskMigrationFromMarker',
    name: string,
    desc: string,
    visible: () => boolean
  ): SettingDefinition => ({
    name,
    desc,
    visible,
    render: (setting) => {
      renderMigrationMarkerControl(setting, field, deps)
    },
  })

  return [
    {
      type: 'group',
      heading: 'General',
      items: [
        {
          name: 'Use folder name as default folder title',
          desc:
            'If this option is checked, and a journal folder title is not ' +
            'configured at folder level, the folder name will be used as ' +
            'title for the journal folder.',
          control: { type: 'toggle', key: 'useFolderNameAsDefaultTitle' },
        },
        {
          name: 'Default journal folder title',
          desc:
            'Used in the rendering of journal headers and to identify the ' +
            'folder in other views. Typically configured per folder via ' +
            'front matter; most users should leave this blank.',
          visible: () => !cur().useFolderNameAsDefaultTitle,
          control: { type: 'text', key: 'journalFolderTitle' },
        },
        {
          name: 'Start of week',
          desc:
            'Controls the first day of the week. This affects both the ' +
            "calendar grid and the way weeks are numbered in 'gggg-[W]ww' " +
            "weekly note names. 'Locale default' leaves Obsidian's bundled " +
            'moment locale untouched. Selecting an explicit day overrides ' +
            'the locale so week 1 of any year is the week containing ' +
            'January 1.',
          control: {
            type: 'dropdown',
            key: 'startOfWeek',
            options: START_OF_WEEK_OPTIONS,
          },
        },
        {
          name: 'Edit-mode indicator',
          desc:
            'Marks the editing surface with a coloured left-edge rule so it ' +
            'is obvious at a glance you are editing, not reading: an accent ' +
            'rule in Live Preview and a muted-grey rule in Source mode. ' +
            'Applies to every note.',
          control: { type: 'toggle', key: 'editModeIndicator' },
        },
        {
          name: 'Enable quarterly notes',
          desc:
            'When enabled, notes named "YYYY-Q[1-4]" are recognised as ' +
            'quarterly journal notes and slot in between yearly and monthly ' +
            'tiers in navigation. The calendar picker also annotates each ' +
            'month title with the quarter (e.g. "January 2026 (Q1)"). ' +
            'Override per-folder by setting "quarters-enabled: true" or ' +
            '"quarters-enabled: false" in that folder\'s journal-folder.md ' +
            'front matter.',
          control: { type: 'toggle', key: 'quartersEnabled' },
        },
      ],
    },
    {
      type: 'group',
      heading: 'Sidebar',
      items: [
        {
          name: 'Sidebar tab',
          desc:
            'The sidebar tab is the entry point for journaling-related ' +
            'actions (folder picker, calendar, configuration editor, ' +
            'initialise). Open it via the calendar ribbon icon.',
        },
        {
          name: 'Hide journal-folder.md in file explorer',
          desc:
            "Hides every 'journal-folder.md' note from Obsidian's built-in " +
            'file explorer. The notes still exist on disk and remain ' +
            'accessible via search and the sidebar.',
          control: { type: 'toggle', key: 'hideJournalFolderNotes' },
        },
      ],
    },
    {
      type: 'group',
      heading: 'Today',
      items: [
        {
          name: 'Today action',
          desc:
            "A one-click jump to the current day's note. Reachable any " +
            'time via the "Open today\'s journal note" command.',
        },
        {
          name: 'Today button placement',
          desc:
            'Where the Today affordance appears. In menu — an item inside ' +
            'the existing Journal Folder ribbon menu. Top-level ribbon icon ' +
            '— its own icon in the ribbon. Off — hidden (the command still ' +
            'works).',
          control: {
            type: 'dropdown',
            key: 'todayButtonPlacement',
            options: {
              menu: 'In the Journal Folder menu',
              ribbon: 'Top-level ribbon icon',
              off: 'Off',
            },
          },
        },
        {
          name: 'Include folders in the Today picker by default',
          desc:
            'When the Today action has more than one eligible journal ' +
            'folder, it asks which one to open. A folder is offered only ' +
            'when this is on. Special cases: a single journal folder is ' +
            'always opened directly; if several folders exist but none opt ' +
            'in, all of them are offered. Override per-folder in ' +
            'journal-folder.md front matter.',
          control: { type: 'toggle', key: 'includeInTodayPicker' },
        },
      ],
    },
    {
      type: 'group',
      heading: 'Calendar',
      items: [
        calendarVisibleDefinition(
          'defaultCalendarVisibleDesktop',
          'Show calendar by default on desktop'
        ),
        calendarVisibleDefinition(
          'defaultCalendarVisibleMobile',
          'Show calendar by default on mobile'
        ),
      ],
    },
    {
      type: 'page',
      name: 'New-note template',
      desc: 'Seed new journal notes from template notes.',
      items: [
        {
          name: 'How templates work',
          desc:
            'When enabled, newly created notes whose names match a journal ' +
            'pattern (e.g. 2026-05-07, 2026-W19, 2026-05, 2026-Q2, 2026) ' +
            "and that live in a folder containing a 'journal-folder.md' " +
            'note are seeded from a template note. Templates live as ' +
            'ordinary notes with standardized names — daily-template.md, ' +
            'weekly-template.md, monthly-template.md, ' +
            'quarterly-template.md, yearly-template.md, and ' +
            'default-template.md as a fallback. Editing one of those notes ' +
            "previews it as the current period's entry, signifiers and " +
            'all. Disable per-folder by adding ' +
            "'auto-template-enabled: false' to that folder's " +
            'journal-folder.md front matter.',
        },
        {
          name: 'Auto-fill new journal notes',
          control: { type: 'toggle', key: 'autoTemplateEnabled' },
        },
        {
          name: 'Template folder',
          desc:
            'Vault folder holding the template notes (daily-template.md, ' +
            'weekly-template.md, …, default-template.md) that seed new ' +
            'journal entries.',
          visible: () => cur().autoTemplateEnabled,
          control: { type: 'text', key: 'templateFolder' },
        },
        {
          name: 'Per-folder override subfolder',
          desc:
            'Name of a subfolder, relative to each journal folder, whose ' +
            'template notes override the global ones for that folder only.',
          visible: () => cur().autoTemplateEnabled,
          control: { type: 'text', key: 'templateOverrideFolderName' },
        },
        {
          name: 'Create template files',
          desc:
            'Adds any missing standardized template notes ' +
            '(daily-template.md, weekly-template.md, monthly-template.md' +
            (cur().quartersEnabled ? ', quarterly-template.md' : '') +
            ', yearly-template.md, default-template.md) to the template ' +
            'folder, seeded with the built-in default. Existing files are ' +
            'left untouched.',
          visible: () => cur().autoTemplateEnabled,
          render: (setting) => {
            setting.addButton((btn) => {
              btn.setButtonText('Create').onClick(async () => {
                const settings = cur()
                const written = await scaffoldTemplateFiles(deps.app, settings)
                new Notice(
                  written > 0
                    ? `Created ${written} template file${written === 1 ? '' : 's'} in ${settings.templateFolder}`
                    : `All template files already exist in ${settings.templateFolder}`
                )
              })
            })
          },
        },
      ],
    },
    {
      type: 'page',
      name: 'Note title patterns',
      desc: 'Date format strings used to render note titles and links.',
      items: [
        { name: 'Pattern syntax', desc: buildPatternsIntroFragment() },
        ...PATTERN_TIERS.map(
          (tier): SettingDefinitionItem => ({
            type: 'group',
            heading: tier.heading,
            visible: tier.quarterly ? () => cur().quartersEnabled : undefined,
            items: [
              ...(tier.note ? [{ ...tier.note }] : []),
              ...tier.fields.map(
                (f): SettingGroupItem => ({
                  name: f.name,
                  desc: f.desc,
                  render: (setting) => {
                    setting.settingEl.dataset.jfSetting = f.field
                    attachMomentSetting(setting, f.field, fieldCfg)
                  },
                })
              ),
            ],
          })
        ),
      ],
    },
    {
      type: 'page',
      name: 'Tasks',
      desc: 'Task behaviour, migration, flows, and categories.',
      items: [
        {
          type: 'group',
          heading: 'General task settings',
          items: [
            {
              name: 'Quick toggles',
              desc:
                'The Today / Dynamic and Show / Hide completed quick ' +
                'toggles live on the sidebar itself.',
            },
            {
              name: 'Maximum tasks shown',
              desc:
                'Hard cap on the number of tasks rendered in the sidebar ' +
                'and in-note blocks. When exceeded, a footer appears with a ' +
                'link back here to increase the limit.',
              control: {
                type: 'number',
                key: 'tasksMaxItems',
                min: 1,
                step: 1,
                defaultValue: DEFAULT_SETTINGS.tasksMaxItems,
                validate: (value) => {
                  if (!Number.isInteger(value) || value <= 0) {
                    return 'Enter a whole number greater than zero.'
                  }
                },
              },
            },
            {
              name: 'Cycle / render tasks',
              desc:
                'Task lists only — wire the cycle and right-click status ' +
                'menu in the plugin’s own task panels (sidebar, tasks-only ' +
                'sidebar, in-note journal-tasks block) and leave document ' +
                'checkboxes to Obsidian. Everywhere — additionally ' +
                'intercept every task checkbox in the rendered document ' +
                '(reading view + live preview); switch back to Task lists ' +
                'only when another plugin (e.g. Tasks) is handling ' +
                'in-document interactions.',
              control: {
                type: 'dropdown',
                key: 'taskInteractionScope',
                options: { lists: 'Task lists only', everywhere: 'Everywhere' },
              },
            },
            {
              name: 'Left-click opens the status menu',
              desc:
                'When on, left-clicking a task checkbox opens the status ' +
                'picker (the same menu as a right-click / long-press) ' +
                'instead of cycling to the next status. Right-click always ' +
                'opens the menu regardless.',
              control: { type: 'toggle', key: 'taskClickOpensPicker' },
            },
            {
              name: 'Migration placement',
              desc: PLACEMENT_DESC,
              control: {
                type: 'dropdown',
                key: 'taskMigrationPlacement',
                options: PLACEMENT_LABELS,
              },
            },
            {
              name: 'Migration heading',
              desc: MIGRATION_HEADING_DESC,
              visible: () => cur().taskMigrationPlacement === 'heading',
              control: { type: 'text', key: 'taskMigrationHeading' },
            },
            {
              name: 'Migration heading level',
              desc: MIGRATION_LEVEL_DESC,
              visible: () => cur().taskMigrationPlacement === 'heading',
              control: {
                type: 'dropdown',
                key: 'taskMigrationHeadingLevel',
                options: Object.fromEntries(
                  LEVEL_OPTIONS.map((o) => [o.value, o.label])
                ),
              },
            },
          ],
        },
        {
          type: 'group',
          heading: 'Migration references',
          items: [
            {
              name: 'About migration references',
              desc:
                'Migration can link the two notes: a forward link on the ' +
                'original task and a back link on the migrated copy. Turn ' +
                'either off to omit that link entirely.',
            },
            {
              name: 'Reference on the original task',
              desc:
                'Add a link to the destination note on the migrated-from ' +
                'task.',
              control: { type: 'toggle', key: 'taskMigrationAddToReference' },
            },
            {
              name: 'Reference on the migrated copy',
              desc:
                'Add a link back to the origin note on the migrated-to task.',
              control: { type: 'toggle', key: 'taskMigrationAddFromReference' },
            },
            {
              name: 'Reference style',
              desc:
                'Text accepts any characters (the defaults are the → and ← ' +
                'arrow glyphs). Emoji and Lucide each add a picker; Lucide ' +
                'markers are stored as “lucide:name” tokens and render as ' +
                'icons in reading view. Switching style resets both markers ' +
                'to that style’s defaults; you can still edit each one.',
              visible: anyMigrationReference,
              control: {
                type: 'dropdown',
                key: 'taskMigrationReferenceStyle',
                options: { text: 'Text', emoji: 'Emoji', lucide: 'Lucide' },
              },
            },
            markerDefinition(
              'taskMigrationToMarker',
              'Migrated-to marker',
              'Placed before the link to the destination on the original ' +
                'task (e.g. “… → [[2026-06-05]]”). Leave empty for just the ' +
                'link.',
              () => anyMigrationReference() && cur().taskMigrationAddToReference
            ),
            markerDefinition(
              'taskMigrationFromMarker',
              'Migrated-from marker',
              'Placed before the link to the origin on the migrated copy ' +
                '(e.g. “… ← [[2026-06-04]]”). Leave empty for just the link.',
              () =>
                anyMigrationReference() && cur().taskMigrationAddFromReference
            ),
            {
              name: 'Reference opacity (reading view)',
              desc:
                'Fades the whole reference (marker + link) in reading view ' +
                'so it recedes until you look for it. Hovering restores ' +
                'full opacity. Needs a non-empty marker to detect the ' +
                'reference.',
              visible: anyMigrationReference,
              control: {
                type: 'slider',
                key: 'taskMigrationReferenceOpacity',
                min: 0,
                max: 100,
                step: 5,
              },
            },
          ],
        },
        {
          type: 'page',
          name: 'Task flows',
          desc:
            'A task flow is a named set of statuses (label, character, ' +
            'cycle target, and visuals). Folders pick which flow they use; ' +
            'edits here flow through to every folder pointing at the same ' +
            'flow. Built-in templates are read-only — apply one to seed a ' +
            'new flow.',
          page: () => new TaskFlowsSettingPage(deps),
        },
        {
          type: 'page',
          name: 'Task categories',
          desc: 'Group tasks by tag at the top of every task list.',
          page: () =>
            new SectionSettingPage('Task categories', 'task-categories', (el, rerender) =>
              renderCategoriesSection({
                app: deps.app,
                containerEl: el,
                getSettings: deps.getCurrentSettings,
                saveSettings: deps.saveSettings,
                rerender,
              })
            ),
        },
      ],
    },
    {
      type: 'page',
      name: 'Signifiers',
      desc:
        'Bind an icon to a tag (e.g. #important → ★) and render it in ' +
        'reading view, live preview, and task lists.',
      page: () =>
        new SectionSettingPage('Signifiers', 'signifiers', (el, rerender) =>
          renderSignifiersSection({
            app: deps.app,
            containerEl: el,
            getSettings: deps.getCurrentSettings,
            saveSettings: deps.saveSettings,
            rerender,
          })
        ),
    },
    {
      type: 'group',
      heading: 'Reset',
      items: [
        {
          name: 'Reset all to default values',
          desc: 'Restores every setting in the plugin to its default.',
          render: (setting) => {
            setting.addButton((btn) => {
              btn
                .setIcon('reset')
                .setDestructive()
                .onClick(() => {
                  new ConfirmModal(deps.app, {
                    title: 'Reset all settings?',
                    message:
                      'Every setting on this screen will be restored to ' +
                      'its default value. This cannot be undone.',
                    confirmText: 'Reset',
                    onConfirm: () => {
                      // noinspection JSIgnoredPromiseFromCall
                      void deps
                        .saveSettings(DEFAULT_SETTINGS)
                        .then(() => deps.requestRerender())
                    },
                  }).open()
                })
            })
          },
        },
      ],
    },
  ]
}

function calendarVisibleDefinition(
  field: 'defaultCalendarVisibleDesktop' | 'defaultCalendarVisibleMobile',
  name: string
): SettingDefinition {
  const frontMatterKey =
    field === 'defaultCalendarVisibleDesktop'
      ? 'default-calendar-visible-desktop'
      : 'default-calendar-visible-mobile'
  return {
    name,
    desc:
      'If checked, the calendar picker is visible when Obsidian starts. ' +
      `Override per-folder by setting "${frontMatterKey}: true" or ` +
      `"${frontMatterKey}: false" in that folder's journal-folder.md ` +
      'front matter. The user can still toggle the calendar from the More ' +
      'popover at any time, and that manual choice persists for the rest ' +
      'of the running Obsidian session.',
    control: { type: 'toggle', key: field },
  }
}

// Marker input + live preview + (style-dependent) picker button. Rendered
// imperatively because the preview and pickers have no declarative
// equivalent.
function renderMigrationMarkerControl(
  setting: Setting,
  field: 'taskMigrationToMarker' | 'taskMigrationFromMarker',
  deps: GlobalSettingsDeps
): void {
  let component: TextComponent
  const style = deps.getCurrentSettings().taskMigrationReferenceStyle

  const save = (value: string) => {
    const settings = { ...deps.getCurrentSettings() }
    settings[field] = value
    // noinspection JSIgnoredPromiseFromCall
    void deps.saveSettings(settings)
  }

  let preview: HTMLElement | null = null
  const refreshPreview = (): void => {
    if (!preview) return
    preview.empty()
    const value = deps.getCurrentSettings()[field]
    if (value.startsWith(LUCIDE_MARKER_PREFIX)) {
      setIcon(preview, value.slice(LUCIDE_MARKER_PREFIX.length).trim())
    } else {
      preview.setText(value)
    }
  }

  setting.addText((text) => {
    component = text
    text.setValue(deps.getCurrentSettings()[field]).onChange(
      debounce(
        (value: string) => {
          save(value)
          refreshPreview()
        },
        250,
        true
      )
    )
  })

  if (style !== 'text') {
    preview = setting.controlEl.createSpan({
      cls: 'jf-migration-marker-preview',
    })
    refreshPreview()
  }

  if (style === 'emoji') {
    setting.addExtraButton((btn) => {
      btn
        .setIcon('smile-plus')
        .setTooltip('Pick an emoji')
        .onClick(() => {
          new EmojiPickerModal(
            deps.app,
            deps.getCurrentSettings()[field],
            (emoji) => {
              save(emoji)
              component.setValue(emoji)
              refreshPreview()
            }
          ).open()
        })
    })
  } else if (style === 'lucide') {
    setting.addExtraButton((btn) => {
      btn
        .setIcon('image')
        .setTooltip('Pick a Lucide icon')
        .onClick(() => {
          const value = deps.getCurrentSettings()[field]
          const current = value.startsWith(LUCIDE_MARKER_PREFIX)
            ? value.slice(LUCIDE_MARKER_PREFIX.length)
            : value
          new LucidePickerModal(deps.app, current, (name) => {
            const token = `${LUCIDE_MARKER_PREFIX}${name}`
            save(token)
            component.setValue(token)
            refreshPreview()
          }).open()
        })
    })
  }
}

// ---- imperative sub-pages -------------------------------------------

// Hosts one of the dynamic-list sections (signifiers, task categories)
// whose add/edit/remove affordances are rendered imperatively.
export class SectionSettingPage extends SettingPage {
  constructor(
    title: string,
    private pageId: string,
    private renderSection: (
      containerEl: HTMLElement,
      rerender: () => void
    ) => void
  ) {
    super()
    this.title = title
  }

  display(): void {
    this.containerEl.empty()
    // Stable hook for the e2e suite — target a page by id, not its label.
    this.containerEl.setAttribute('data-jf-settings-page', this.pageId)
    this.renderSection(this.containerEl, () => this.display())
  }
}

// The task-flow editor with its flow → status drill-down. State lives on
// the page instance, so it survives re-renders within a single open (the
// factory creates a fresh page — and a fresh overview — each time the
// user navigates in).
export class TaskFlowsSettingPage extends SettingPage {
  private editingFlow: string | null = null
  private editingStatusId: string | null = null
  private activeStatusSection: StatusDetailSection = 'basics'

  constructor(private deps: GlobalSettingsDeps) {
    super()
    this.title = 'Task flows'
  }

  display(): void {
    this.containerEl.empty()
    this.containerEl.setAttribute('data-jf-settings-page', 'task-flows')
    const settings = { ...this.deps.getCurrentSettings() }

    // Guard against stale drill-down references — if the flow / status
    // the user was viewing was removed in another window, bounce them
    // up the chain.
    if (this.editingFlow && !(this.editingFlow in settings.taskFlows)) {
      this.editingFlow = null
      this.editingStatusId = null
    }
    if (this.editingFlow && this.editingStatusId !== null) {
      const flow = settings.taskFlows[this.editingFlow]
      const flowStatuses = flow?.statuses ?? []
      if (!flowStatuses.some((s) => s.id === this.editingStatusId)) {
        this.editingStatusId = null
      }
    }

    if (this.editingFlow && this.editingStatusId !== null) {
      this.displayStatusDetail(settings)
    } else if (this.editingFlow) {
      this.displayFlowDetail(settings)
    } else {
      this.displayOverview(settings)
    }
  }

  private readonly rerender = (): void => {
    this.display()
  }

  private displayOverview(settings: JournalFolderSettings): void {
    renderTaskFlowOverview({
      app: this.deps.app,
      containerEl: this.containerEl,
      getSettings: () => settings,
      saveSettings: this.deps.saveSettings,
      rerender: this.rerender,
      onOpenFlow: (name) => {
        this.editingFlow = name
        this.editingStatusId = null
        this.activeStatusSection = 'basics'
        this.display()
      },
    })
  }

  private displayFlowDetail(settings: JournalFolderSettings): void {
    const flowName = this.editingFlow!
    renderBreadcrumb(this.containerEl, [
      {
        label: 'Task flows',
        onClick: () => {
          this.editingFlow = null
          this.editingStatusId = null
          this.display()
        },
      },
      { label: flowName },
    ])

    new Setting(this.containerEl).setName(`Flow: ${flowName}`).setHeading()

    renderTaskFlowDetail({
      app: this.deps.app,
      containerEl: this.containerEl,
      flowName,
      getSettings: () => settings,
      saveSettings: this.deps.saveSettings,
      rerender: this.rerender,
      onOpenStatus: (statusId) => {
        this.editingStatusId = statusId
        this.activeStatusSection = 'basics'
        this.display()
      },
      onFlowDeleted: () => {
        this.editingFlow = null
        this.editingStatusId = null
        this.display()
      },
      onFlowRenamed: (newName) => {
        this.editingFlow = newName
        this.editingStatusId = null
        this.display()
      },
    })
  }

  private displayStatusDetail(settings: JournalFolderSettings): void {
    const flowName = this.editingFlow!
    const statusId = this.editingStatusId!
    const flow = settings.taskFlows[flowName]
    const flowStatuses = flow?.statuses ?? []
    const status = flowStatuses.find((s) => s.id === statusId)
    const statusLabel = status?.label || status?.id || statusId

    renderBreadcrumb(this.containerEl, [
      {
        label: 'Task flows',
        onClick: () => {
          this.editingFlow = null
          this.editingStatusId = null
          this.display()
        },
      },
      {
        label: flowName,
        onClick: () => {
          this.editingStatusId = null
          this.display()
        },
      },
      { label: statusLabel },
    ])

    new Setting(this.containerEl)
      .setName(`Status: ${statusLabel}`)
      .setHeading()

    renderStatusDetail({
      containerEl: this.containerEl,
      settings,
      flowName,
      statusId,
      activeSection: this.activeStatusSection,
      setActiveSection: (next) => {
        this.activeStatusSection = next
      },
      saveSettings: this.deps.saveSettings,
      rerender: this.rerender,
    })
  }
}

interface ConfirmModalOptions {
  title: string
  message: string
  confirmText: string
  onConfirm: () => void
}

export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private options: ConfirmModalOptions
  ) {
    super(app)
  }

  onOpen() {
    const { titleEl, contentEl } = this
    titleEl.setText(this.options.title)
    contentEl.createEl('p', { text: this.options.message })

    const buttons = contentEl.createDiv({ cls: 'modal-button-container' })

    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
      this.close()
    })

    new ButtonComponent(buttons)
      .setButtonText(this.options.confirmText)
      .setDestructive()
      .onClick(() => {
        this.close()
        this.options.onConfirm()
      })
  }

  onClose() {
    this.contentEl.empty()
  }
}
