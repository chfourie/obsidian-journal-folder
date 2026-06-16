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
  DropdownComponent,
  Modal,
  MomentFormatComponent,
  Notice,
  type Plugin,
  PluginSettingTab,
  setIcon,
  Setting,
  TextComponent,
  ToggleComponent,
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
  type TodayButtonPlacement,
  type TaskMigrationReferenceStyle,
  TEMPLATE_FILENAMES,
} from '../../data-access'
import { DEFAULT_AUTO_TEMPLATE, ensureFolderExists } from '../journal-auto-template'
import {
  renderBreadcrumb,
  renderFolderTaskFlowSection,
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

const START_OF_WEEK_OPTIONS: Record<StartOfWeekSetting, string> = {
  'locale-default': 'Locale default',
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
}

type SettingsStringFieldName =
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

// `'global'` renders the full plugin-settings tab; `'folder'` skips
// global-only fields (start-of-week, hide-config-notes, sidebar section)
// and the destructive Reset section, since those don't make sense per-folder.
export type SettingsFormMode = 'global' | 'folder'

export type SettingsFormConfig = {
  app: App
  containerEl: HTMLElement
  mode: SettingsFormMode
  getCurrentSettings: () => JournalFolderSettings
  saveSettings: (settings: JournalFolderSettings) => Promise<void>
}

/***************************************************************************************************
 ** NOTE: This class has been slapped together in order to get the plugin released into the wild. **
 ** It does the job, but will be replaced with a more refined version somewhere in the future.    **
 ** ************************************************************************************************/
export class JournalFolderSettingsTab extends PluginSettingTab {
  constructor(
    private plugin: Plugin,
    private getCurrentSettings: () => JournalFolderSettings,
    private saveSettings: (settings: JournalFolderSettings) => Promise<void>
  ) {
    super(plugin.app, plugin)
  }

  display() {
    renderSettingsForm({
      app: this.plugin.app,
      containerEl: this.containerEl,
      mode: 'global',
      getCurrentSettings: this.getCurrentSettings,
      saveSettings: this.saveSettings,
    })
  }
}

// Renders the settings form into the given container. Mode flag controls
// which sections appear: `'global'` includes everything (used by the
// plugin settings tab); `'folder'` strips out global-only sections and
// the Reset section (used by the per-folder config modal).
//
// Re-renders in place when the user toggles a field that changes the
// form's structure (`useFolderNameAsDefaultTitle`, `quartersEnabled`,
// `autoTemplateEnabled`) — same behaviour the original `display()` had.
export function renderSettingsForm(config: SettingsFormConfig): void {
  new SettingsFormBuilder(config).render()
}

// Tab identifiers used by the settings form's top tab strip. Order
// here drives the tab order in the UI.
type TabId =
  | 'general'
  | 'templates'
  | 'patterns'
  | 'tasks'
  | 'signifiers'
  | 'reset'

type TabDef = {
  id: TabId
  label: string
  isVisible: (isFolder: boolean) => boolean
  render: (
    builder: SettingsFormBuilder,
    settings: JournalFolderSettings,
    isFolder: boolean
  ) => void
}

class SettingsFormBuilder {
  // Sticky across re-renders within a single open of the settings
  // tab. The builder is created once by `display()` /
  // `FolderConfigModal.onOpen` and reused for every internal
  // re-render fired by structural toggles, so this preserves the
  // user's tab selection through those redraws.
  private activeTab: TabId = 'general'
  // Drill-down state for the Tasks tab. `null` for both → tasks
  // overview. Flow set, status null → flow detail. Both set →
  // status detail. The fields persist across structural re-renders
  // for the same reason `activeTab` does (single builder per open).
  private editingFlow: string | null = null
  private editingStatusId: string | null = null
  private activeStatusSection: StatusDetailSection = 'basics'
  // The current tab's content host. Section render helpers all call
  // `this.containerEl`, which resolves to this when a tab is being
  // drawn so the existing call sites don't need to change.
  private tabContentEl: HTMLElement | null = null

  constructor(private config: SettingsFormConfig) {}

  private get containerEl(): HTMLElement {
    return this.tabContentEl ?? this.config.containerEl
  }

  private get plugin(): { app: App } {
    return { app: this.config.app }
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
    root.addClass('jf-settings-tabbed')

    const settings = { ...this.getCurrentSettings() }
    const isFolder = this.config.mode === 'folder'

    const visibleTabs = TABS.filter((tab) => tab.isVisible(isFolder))
    if (!visibleTabs.some((t) => t.id === this.activeTab)) {
      this.activeTab = visibleTabs[0]?.id ?? 'general'
    }

    // ---- tab strip ----------------------------------------------
    const strip = root.createDiv({ cls: 'jf-settings-tab-strip' })
    for (const tab of visibleTabs) {
      const btn = strip.createEl('button', {
        cls: 'jf-settings-tab',
        text: tab.label,
      })
      btn.type = 'button'
      // Stable hook for the e2e suite — target a tab by its stable id
      // rather than its translated label.
      btn.setAttribute('data-jf-settings-tab', tab.id)
      if (tab.id === this.activeTab) btn.addClass('is-active')
      btn.onclick = (e) => {
        e.preventDefault()
        this.activeTab = tab.id
        this.render()
      }
    }

    // ---- active tab content -------------------------------------
    this.tabContentEl = root.createDiv({ cls: 'jf-settings-tab-panel' })
    this.tabContentEl.setAttribute('data-jf-tab-panel', this.activeTab)
    const tabDef = visibleTabs.find((t) => t.id === this.activeTab)
    tabDef?.render(this, settings, isFolder)
    this.tabContentEl = null
  }

  // ---- per-tab renderers --------------------------------------

  renderGeneralTab(settings: JournalFolderSettings, isFolder: boolean): void {
    new Setting(this.containerEl).setName('General').setHeading()
    this.createUseFolderNameAsDefaultTitleSetting(settings)
    if (!settings.useFolderNameAsDefaultTitle) {
      this.createTextSetting(
        settings,
        'journalFolderTitle',
        isFolder ? 'Folder title' : 'Default journal folder title'
      ).setDesc(
        isFolder
          ? "Display title shown above the H1 in this folder's journal " +
              'headers. Leave blank to inherit the global default.'
          : 'Used in the rendering of journal headers and to identify the folder ' +
              'in other views. Typically configured per folder via front matter; ' +
              'most users should leave this blank.'
      )
    }
    if (!isFolder) {
      this.createStartOfWeekSetting(settings)
    }
    this.createQuartersEnabledSetting(settings)

    if (!isFolder) {
      new Setting(this.containerEl).setName('Sidebar').setHeading().setDesc(
        'The sidebar tab is the entry point for journaling-related actions ' +
          '(folder picker, calendar, configuration editor, initialise). Open ' +
          'it via the calendar ribbon icon.'
      )
      this.createHideJournalFolderNotesSetting(settings)
    }

    new Setting(this.containerEl)
      .setName('Today')
      .setHeading()
      .setDesc(
        isFolder
          ? "Whether this folder participates in the plugin's Today action."
          : "A one-click jump to the current day's note. Reachable any time " +
              'via the "Open today\'s journal note" command.'
      )
    if (!isFolder) {
      this.createTodayButtonPlacementSetting(settings)
    }
    this.createIncludeInTodayPickerSetting(settings, isFolder)

    new Setting(this.containerEl).setName('Calendar').setHeading()
    this.createDefaultCalendarVisibleSetting(
      settings,
      'defaultCalendarVisibleDesktop',
      'Show calendar by default on desktop'
    )
    this.createDefaultCalendarVisibleSetting(
      settings,
      'defaultCalendarVisibleMobile',
      'Show calendar by default on mobile'
    )
  }

  renderTemplatesTab(
    settings: JournalFolderSettings,
    isFolder = false
  ): void {
    new Setting(this.containerEl).setName('New-note template').setHeading()
      .setDesc(
        "When enabled, newly created notes whose names match a journal " +
          "pattern (e.g. 2026-05-07, 2026-W19, 2026-05, 2026-Q2, 2026) and " +
          "that live in a folder containing a 'journal-folder.md' note are " +
          "seeded from a template note. Templates live as ordinary notes " +
          "with standardized names — daily-template.md, weekly-template.md, " +
          "monthly-template.md, quarterly-template.md, yearly-template.md, " +
          "and default-template.md as a fallback. Editing " +
          "one of those notes previews it as the current period's entry, " +
          "signifiers and all. Disable per-folder by adding " +
          "'auto-template-enabled: false' to that folder's journal-folder.md " +
          "front matter."
      )
    this.createAutoTemplateEnabledSetting(settings)
    if (!settings.autoTemplateEnabled) return

    if (isFolder) {
      // Template-folder paths are global-only. Per-folder overrides are
      // expressed by dropping files into the override subfolder, not via a
      // setting — so the folder modal only carries the enable toggle plus
      // this hint.
      new Setting(this.containerEl)
        .setName('Per-folder template overrides')
        .setDesc(
          `Drop standardized template notes (daily-template.md, ` +
            `monthly-template.md, …) into ` +
            `a '${settings.templateOverrideFolderName}' subfolder of this ` +
            `journal folder to override the global templates for this folder ` +
            `only. They take precedence over the global template folder.`
        )
      return
    }

    this.createTextSetting(settings, 'templateFolder', 'Template folder').setDesc(
      'Vault folder holding the template notes (daily-template.md, ' +
        'weekly-template.md, …, default-template.md) that seed new journal ' +
        'entries.'
    )
    this.createTextSetting(
      settings,
      'templateOverrideFolderName',
      'Per-folder override subfolder'
    ).setDesc(
      'Name of a subfolder, relative to each journal folder, whose template ' +
        'notes override the global ones for that folder only.'
    )
    this.createScaffoldTemplatesSetting(settings)
  }

  // Creates any missing standardized template notes in the configured
  // template folder, seeded with the built-in default body, so the user has
  // files to edit instead of starting from scratch.
  createScaffoldTemplatesSetting(settings: JournalFolderSettings): Setting {
    return new Setting(this.containerEl)
      .setName('Create template files')
      .setDesc(
        'Adds any missing standardized template notes (daily-template.md, ' +
          'weekly-template.md, monthly-template.md' +
          (settings.quartersEnabled ? ', quarterly-template.md' : '') +
          ', yearly-template.md, default-template.md) to the template folder, ' +
          'seeded with the ' +
          'built-in default. Existing files are left untouched.'
      )
      .addButton((btn) => {
        btn.setButtonText('Create').onClick(async () => {
          const written = await this.scaffoldTemplateFiles(settings)
          new Notice(
            written > 0
              ? `Created ${written} template file${written === 1 ? '' : 's'} in ${settings.templateFolder}`
              : `All template files already exist in ${settings.templateFolder}`
          )
        })
      })
  }

  private async scaffoldTemplateFiles(
    settings: JournalFolderSettings
  ): Promise<number> {
    const app = this.config.app
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

  renderPatternsTab(settings: JournalFolderSettings): void {
    this.createPatternsHeading()

    new Setting(this.containerEl).setName('Daily notes').setHeading()
    this.createMomentSetting(
      settings,
      'dailyNoteTitlePattern',
      'Title pattern'
    ).setDesc('Rendered as the title of a daily note.')
    this.createMomentSetting(
      settings,
      'dailyNoteShortTitlePattern',
      'Short link pattern'
    ).setDesc('Used for compact in-line links to daily notes.')
    this.createMomentSetting(
      settings,
      'dailyNoteMediumTitlePattern',
      'Cross-year link pattern'
    ).setDesc('Used for links to daily notes that fall in a different year.')

    new Setting(this.containerEl).setName('Weekly notes').setHeading().setDesc(
      "Use 'gg' or 'gggg' (not 'YY' / 'YYYY') for the year component so it " +
        'tracks the ISO/locale week year.'
    )
    this.createMomentSetting(
      settings,
      'weeklyNoteTitlePattern',
      'Title pattern'
    ).setDesc('Rendered as the title of a weekly note.')
    this.createMomentSetting(
      settings,
      'weeklyNoteShortTitlePattern',
      'Short link pattern'
    ).setDesc('Used for compact in-line links to weekly notes.')
    this.createMomentSetting(
      settings,
      'weeklyNoteMediumTitlePattern',
      'Cross-year link pattern'
    ).setDesc('Used for links to weekly notes that fall in a different year.')

    new Setting(this.containerEl).setName('Monthly notes').setHeading()
    this.createMomentSetting(
      settings,
      'monthlyNoteTitlePattern',
      'Title pattern'
    ).setDesc('Rendered as the title of a monthly note.')
    this.createMomentSetting(
      settings,
      'monthlyNoteShortTitlePattern',
      'Short link pattern'
    ).setDesc('Used for compact in-line links to monthly notes.')
    this.createMomentSetting(
      settings,
      'monthlyNoteMediumTitlePattern',
      'Cross-year link pattern'
    ).setDesc('Used for links to monthly notes that fall in a different year.')

    if (settings.quartersEnabled) {
      new Setting(this.containerEl).setName('Quarterly notes').setHeading()
      this.createMomentSetting(
        settings,
        'quarterlyNoteTitlePattern',
        'Title pattern'
      ).setDesc('Rendered as the title of a quarterly note.')
      this.createMomentSetting(
        settings,
        'quarterlyNoteShortTitlePattern',
        'Short link pattern'
      ).setDesc('Used for compact in-line links to quarterly notes.')
      this.createMomentSetting(
        settings,
        'quarterlyNoteMediumTitlePattern',
        'Cross-year link pattern'
      ).setDesc(
        'Used for links to quarterly notes that fall in a different year.'
      )
    }

    new Setting(this.containerEl).setName('Yearly notes').setHeading()
    this.createMomentSetting(
      settings,
      'yearlyNoteTitlePattern',
      'Title pattern'
    ).setDesc('Rendered as the title of a yearly note.')
    this.createMomentSetting(
      settings,
      'yearlyNoteShortTitlePattern',
      'Short link pattern'
    ).setDesc('Used for compact in-line links to yearly notes.')
  }

  renderTasksTab(settings: JournalFolderSettings): void {
    // Guard against stale drill-down references — if the flow / status
    // the user was viewing was removed in another window, bounce them
    // up the chain.
    if (
      this.editingFlow &&
      !(this.editingFlow in settings.taskFlows)
    ) {
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
      this.renderTasksStatusDetail(settings)
    } else if (this.editingFlow) {
      this.renderTasksFlowDetail(settings)
    } else {
      this.renderTasksOverview(settings)
    }
  }

  private renderTasksOverview(settings: JournalFolderSettings): void {
    new Setting(this.containerEl)
      .setName('General task settings')
      .setHeading()
      .setDesc(
        'Plugin-wide task behaviour that isn’t bound to a specific ' +
          'flow. The Today / Dynamic and Show / Hide completed quick ' +
          'toggles live on the sidebar itself.'
      )
    this.createTasksMaxItemsSetting(settings)
    this.createTaskInteractionScopeSetting(settings)
    this.createTaskClickOpensPickerSetting(settings)
    this.createMigrationPlacementSettings(settings)
    this.createMigrationReferenceSettings(settings)

    new Setting(this.containerEl)
      .setName('Task flows')
      .setHeading()
      .setDesc(
        'A task flow is a named set of statuses (label, character, ' +
          'cycle target, and visuals). Folders pick which flow they ' +
          'use; edits here flow through to every folder pointing at ' +
          'the same flow. Built-in templates are read-only — apply ' +
          'one to seed a new flow. Click a flow to drill into its ' +
          'detail.'
      )
    renderTaskFlowOverview({
      app: this.config.app,
      containerEl: this.containerEl,
      getSettings: () => settings,
      saveSettings: (next) => this.saveSettings(next),
      rerender: () => this.render(),
      onOpenFlow: (name) => {
        this.editingFlow = name
        this.editingStatusId = null
        this.activeStatusSection = 'basics'
        this.render()
      },
    })

    renderCategoriesSection({
      app: this.config.app,
      containerEl: this.containerEl,
      getSettings: () => this.getCurrentSettings(),
      saveSettings: (next: JournalFolderSettings) => this.saveSettings(next),
      rerender: () => this.render(),
    })
  }

  // Signifiers are a feature in their own right (they apply to any
  // rendered markdown, not just tasks), so they get a dedicated tab rather
  // than living under Tasks. Task *categories* stay under Tasks because
  // they only shape task lists.
  renderSignifiersTab(_settings: JournalFolderSettings): void {
    renderSignifiersSection({
      app: this.config.app,
      containerEl: this.containerEl,
      getSettings: () => this.getCurrentSettings(),
      saveSettings: (next: JournalFolderSettings) => this.saveSettings(next),
      rerender: () => this.render(),
    })
  }

  private renderTasksFlowDetail(settings: JournalFolderSettings): void {
    const flowName = this.editingFlow!
    renderBreadcrumb(this.containerEl, [
      {
        label: 'Tasks',
        onClick: () => {
          this.editingFlow = null
          this.editingStatusId = null
          this.render()
        },
      },
      { label: flowName },
    ])

    new Setting(this.containerEl)
      .setName(`Flow: ${flowName}`)
      .setHeading()

    renderTaskFlowDetail({
      app: this.config.app,
      containerEl: this.containerEl,
      flowName,
      getSettings: () => settings,
      saveSettings: (next) => this.saveSettings(next),
      rerender: () => this.render(),
      onOpenStatus: (statusId) => {
        this.editingStatusId = statusId
        this.activeStatusSection = 'basics'
        this.render()
      },
      onFlowDeleted: () => {
        this.editingFlow = null
        this.editingStatusId = null
        this.render()
      },
      onFlowRenamed: (newName) => {
        this.editingFlow = newName
        this.editingStatusId = null
        this.render()
      },
    })
  }

  private renderTasksStatusDetail(settings: JournalFolderSettings): void {
    const flowName = this.editingFlow!
    const statusId = this.editingStatusId!
    const flow = settings.taskFlows[flowName]
    const flowStatuses = flow?.statuses ?? []
    const status = flowStatuses.find((s) => s.id === statusId)
    const statusLabel = status?.label || status?.id || statusId

    renderBreadcrumb(this.containerEl, [
      {
        label: 'Tasks',
        onClick: () => {
          this.editingFlow = null
          this.editingStatusId = null
          this.render()
        },
      },
      {
        label: flowName,
        onClick: () => {
          this.editingStatusId = null
          this.render()
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
      saveSettings: (next) => this.saveSettings(next),
      rerender: () => this.render(),
    })
  }

  renderFolderTasksTab(settings: JournalFolderSettings): void {
    new Setting(this.containerEl)
      .setName('Tasks')
      .setHeading()
      .setDesc(
        "The flow that drives this folder's task icons and cycles. " +
          'Flow contents are edited globally — pick "Use default" to ' +
          'inherit whatever the global default flow is at the time ' +
          'tasks render.'
      )
    this.createFolderTaskFlowSection(settings)
    this.createMigrationPlacementSettings(settings)
  }

  // Migration placement is one of the few task fields a folder may
  // override (it's a per-note layout concern), so this renders in both
  // the global Tasks overview and the per-folder modal's Tasks tab. The
  // heading text input only shows when placement is "Under a heading";
  // a re-render toggles it as the dropdown changes.
  createMigrationPlacementSettings(settings: JournalFolderSettings): void {
    const PLACEMENT_LABELS: Record<TaskMigrationPlacement, string> = {
      'after-last-task': 'After the last task',
      heading: 'Under a heading',
      top: 'Top of note',
      end: 'End of note',
    }

    let dropdown: DropdownComponent

    const onPlacement = async (value: string) => {
      settings.taskMigrationPlacement = value as TaskMigrationPlacement
      // Await the save so the subsequent re-render reads the updated
      // settings — `render()` rebuilds from `getCurrentSettings()`, which
      // only reflects the change after `saveSettings` has propagated.
      await this.saveSettings(settings)
      this.render()
    }

    new Setting(this.containerEl)
      .setName('Migration placement')
      .setDesc(
        'Where the task-migration commands insert copied tasks in the ' +
          'destination note.'
      )
      .addDropdown((dd) => {
        dropdown = dd
        for (const value of Object.keys(
          PLACEMENT_LABELS
        ) as TaskMigrationPlacement[]) {
          dd.addOption(value, PLACEMENT_LABELS[value])
        }
        dd.setValue(settings.taskMigrationPlacement).onChange(onPlacement)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            dropdown.setValue(DEFAULT_SETTINGS.taskMigrationPlacement)
            void onPlacement(DEFAULT_SETTINGS.taskMigrationPlacement)
          })
      })

    if (settings.taskMigrationPlacement === 'heading') {
      new Setting(this.containerEl)
        .setName('Migration heading')
        .setDesc(
          'Heading migrated tasks are placed under (matched ' +
            'case-insensitively; created as a level-2 heading if missing).'
        )
        .addText((text) => {
          text.setValue(settings.taskMigrationHeading).onChange(
            debounce((value: string) => {
              settings.taskMigrationHeading = value.trim() || 'Tasks'
              // noinspection JSIgnoredPromiseFromCall
              void this.saveSettings(settings)
            }, 250, true)
          )
        })
    }
  }

  // Cross-reference markers written on each side of a migration. Global
  // only — they're not in PER_FOLDER_FIELDS, so this renders in the
  // global Tasks tab but not the per-folder modal. The style dropdown
  // reseeds both marker inputs with that style's defaults; the inputs
  // stay editable, and in Emoji mode each gains a "Pick…" button that
  // opens the shared emoji picker modal.
  createMigrationReferenceSettings(settings: JournalFolderSettings): void {
    const STYLE_LABELS: Record<TaskMigrationReferenceStyle, string> = {
      text: 'Text',
      emoji: 'Emoji',
      lucide: 'Lucide',
    }

    new Setting(this.containerEl)
      .setName('Migration references')
      .setHeading()
      .setDesc(
        'Migration can link the two notes: a forward link on the original ' +
          'task and a back link on the migrated copy. Turn either off to ' +
          'omit that link entirely.'
      )

    const onToggle = async (
      field: 'taskMigrationAddToReference' | 'taskMigrationAddFromReference',
      value: boolean
    ) => {
      settings[field] = value
      // Await so the re-render (which shows/hides the marker rows) reads
      // the updated value from `getCurrentSettings()`.
      await this.saveSettings(settings)
      this.render()
    }

    new Setting(this.containerEl)
      .setName('Reference on the original task')
      .setDesc('Add a link to the destination note on the migrated-from task.')
      .addToggle((t) =>
        t
          .setValue(settings.taskMigrationAddToReference)
          .onChange((v) => onToggle('taskMigrationAddToReference', v))
      )

    new Setting(this.containerEl)
      .setName('Reference on the migrated copy')
      .setDesc('Add a link back to the origin note on the migrated-to task.')
      .addToggle((t) =>
        t
          .setValue(settings.taskMigrationAddFromReference)
          .onChange((v) => onToggle('taskMigrationAddFromReference', v))
      )

    // Style + marker inputs are only meaningful when at least one
    // reference is enabled.
    if (
      !settings.taskMigrationAddToReference &&
      !settings.taskMigrationAddFromReference
    ) {
      return
    }

    new Setting(this.containerEl)
      .setName('Reference style')
      .setDesc(
        'Text accepts any characters (the defaults are the → and ← arrow ' +
          'glyphs). Emoji and Lucide each add a picker; Lucide markers are ' +
          'stored as “lucide:name” tokens and render as icons in reading ' +
          'view. Switching style resets both markers to that style’s ' +
          'defaults; you can still edit each one.'
      )
      .addDropdown((dd) => {
        for (const value of Object.keys(
          STYLE_LABELS
        ) as TaskMigrationReferenceStyle[]) {
          dd.addOption(value, STYLE_LABELS[value])
        }
        dd.setValue(settings.taskMigrationReferenceStyle).onChange(
          async (value) => {
            const style = value as TaskMigrationReferenceStyle
            settings.taskMigrationReferenceStyle = style
            settings.taskMigrationToMarker =
              MIGRATION_REFERENCE_PRESETS[style].to
            settings.taskMigrationFromMarker =
              MIGRATION_REFERENCE_PRESETS[style].from
            // Await so the re-render reads the reseeded markers — the
            // form rebuilds from `getCurrentSettings()`, which only
            // reflects the change once `saveSettings` has propagated.
            await this.saveSettings(settings)
            this.render()
          }
        )
      })

    if (settings.taskMigrationAddToReference) {
      this.createMigrationMarkerSetting(
        settings,
        'taskMigrationToMarker',
        'Migrated-to marker',
        'Placed before the link to the destination on the original task ' +
          '(e.g. “… → [[2026-06-05]]”). Leave empty for just the link.'
      )
    }
    if (settings.taskMigrationAddFromReference) {
      this.createMigrationMarkerSetting(
        settings,
        'taskMigrationFromMarker',
        'Migrated-from marker',
        'Placed before the link to the origin on the migrated copy ' +
          '(e.g. “… ← [[2026-06-04]]”). Leave empty for just the link.'
      )
    }

    new Setting(this.containerEl)
      .setName('Reference opacity (reading view)')
      .setDesc(
        'Fades the whole reference (marker + link) in reading view so it ' +
          'recedes until you look for it. Hovering restores full opacity. ' +
          'Needs a non-empty marker to detect the reference.'
      )
      .addSlider((slider) => {
        slider
          .setLimits(0, 100, 5)
          .setValue(settings.taskMigrationReferenceOpacity)
          .onChange((value) => {
            settings.taskMigrationReferenceOpacity = value
            // noinspection JSIgnoredPromiseFromCall
            void this.saveSettings(settings)
          })
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(async () => {
            settings.taskMigrationReferenceOpacity =
              DEFAULT_SETTINGS.taskMigrationReferenceOpacity
            await this.saveSettings(settings)
            this.render()
          })
      })
  }

  private createMigrationMarkerSetting(
    settings: JournalFolderSettings,
    field: 'taskMigrationToMarker' | 'taskMigrationFromMarker',
    name: string,
    desc: string
  ): void {
    let component: TextComponent
    const style = settings.taskMigrationReferenceStyle

    const setting = new Setting(this.containerEl).setName(name).setDesc(desc)

    // Live preview of the marker. For Lucide it renders the actual icon
    // (the stored `lucide:<name>` token isn't human-readable); for other
    // styles it just echoes the marker character(s).
    let preview: HTMLElement | null = null
    const refreshPreview = (): void => {
      if (!preview) return
      preview.empty()
      const value = settings[field]
      if (value.startsWith(LUCIDE_MARKER_PREFIX)) {
        setIcon(preview, value.slice(LUCIDE_MARKER_PREFIX.length).trim())
      } else {
        preview.setText(value)
      }
    }

    setting.addText((text) => {
      component = text
      text.setValue(settings[field]).onChange(
        debounce((value: string) => {
          settings[field] = value
          refreshPreview()
          // noinspection JSIgnoredPromiseFromCall
          void this.saveSettings(settings)
        }, 250, true)
      )
    })

    if (style !== 'text') {
      preview = setting.controlEl.createSpan({
        cls: 'jf-migration-marker-preview',
      })
      refreshPreview()
    }

    // Emoji / Lucide modes get a picker that reuses the task-status icon
    // grids. Lucide stores a `lucide:<name>` token; the picker works in
    // bare names, so strip / re-add the prefix around it.
    if (style === 'emoji') {
      setting.addExtraButton((btn) => {
        btn
          .setIcon('smile-plus')
          .setTooltip('Pick an emoji')
          .onClick(() => {
            new EmojiPickerModal(
              this.config.app,
              settings[field],
              async (emoji) => {
                settings[field] = emoji
                component.setValue(emoji)
                refreshPreview()
                await this.saveSettings(settings)
              }
            ).open()
          })
      })
    } else if (style === 'lucide') {
      setting.addExtraButton((btn) => {
        btn
          .setIcon('image')
          // eslint-disable-next-line obsidianmd/ui/sentence-case -- 'Lucide' is a proper noun (the icon library)
          .setTooltip('Pick a Lucide icon')
          .onClick(() => {
            const current = settings[field].startsWith(LUCIDE_MARKER_PREFIX)
              ? settings[field].slice(LUCIDE_MARKER_PREFIX.length)
              : settings[field]
            new LucidePickerModal(this.config.app, current, async (name) => {
              const token = `${LUCIDE_MARKER_PREFIX}${name}`
              settings[field] = token
              component.setValue(token)
              refreshPreview()
              await this.saveSettings(settings)
            }).open()
          })
      })
    }
  }

  renderResetTab(): void {
    new Setting(this.containerEl).setName('Reset').setHeading()
    new Setting(this.containerEl)
      .setName('Reset all to default values')
      .setDesc('Restores every setting in the plugin to its default.')
      .addButton((btn) => {
        btn
          .setIcon('reset')
          .setWarning() // eslint-disable-line @typescript-eslint/no-deprecated -- setDestructive needs Obsidian 1.13.0 (> our 1.7.2 floor); revisit when minAppVersion is raised
          .onClick(() => {
            new ConfirmModal(this.plugin.app, {
              title: 'Reset all settings?',
              message:
                'Every setting on this screen will be restored to its ' +
                'default value. This cannot be undone.',
              confirmText: 'Reset',
              onConfirm: () => {
                // noinspection JSIgnoredPromiseFromCall
                void this.saveSettings(DEFAULT_SETTINGS).then(() => this.render())
              },
            }).open()
          })
      })
  }

  createPatternsHeading() {
    const desc = activeDocument.createDocumentFragment()
    desc.append(
      'Date format strings used to render note titles and links. Each ' +
        "pattern should not render units shorter than its tier (e.g. don't " +
        'use day components in a monthly pattern). '
    )
    const link = activeDocument.createElement('a')
    link.href = 'https://momentjs.com/docs/#/displaying/format/'
    link.textContent = 'Pattern syntax reference'
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener')
    desc.append(link)
    desc.append('.')

    new Setting(this.containerEl)
      .setName('Note title patterns')
      .setHeading()
      .setDesc(desc)
  }

  createMomentSetting(
    settings: JournalFolderSettings,
    fieldName: SettingsStringFieldName,
    name: string
  ): Setting {
    let component: MomentFormatComponent
    const sampleValueEl = activeDocument.createElement('div')
    sampleValueEl.addClass('journal-folder-config-sample-value')

    const setting = new Setting(this.containerEl)
    setting.settingEl.dataset.jfSetting = fieldName
    setting
      .setName(name)
      .addMomentFormat((text) => {
        component = text
        const onChange = debounce(
          (value: string) => {
            settings[fieldName] = value
            // noinspection JSIgnoredPromiseFromCall
            void this.saveSettings(settings)
          },
          250,
          true
        )

        text.setDefaultFormat(DEFAULT_SETTINGS[fieldName])
        text.setValue(settings[fieldName]).onChange(onChange)
        text.setSampleEl(sampleValueEl)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS[fieldName])
            component.onChanged()
          })
      })

    const sampleEl = activeDocument.createElement('div')
    sampleEl.addClass('journal-folder-config-hints-row')

    const sampleLabelEl = activeDocument.createElement('div')
    sampleLabelEl.addClass('journal-folder-config-sample-label')
    sampleLabelEl.setText('Sample value:')

    sampleEl.appendChild(sampleLabelEl)
    sampleEl.appendChild(sampleValueEl)
    this.containerEl.appendChild(sampleEl)
    return setting
  }

  createTextSetting(
    settings: JournalFolderSettings,
    fieldName: SettingsStringFieldName,
    name: string
  ): Setting {
    const setting = new Setting(this.containerEl)
    // Stable hook for the e2e suite: target a field's control by its settings
    // key (`[data-jf-setting="dailyNoteTitlePattern"] input`).
    setting.settingEl.dataset.jfSetting = fieldName
    let component: TextComponent

    return setting
      .setName(name)
      .addText((text) => {
        component = text
        const onChange = debounce(
          (value: string) => {
            settings[fieldName] = value
            // noinspection JSIgnoredPromiseFromCall
            void this.saveSettings(settings)
          },
          250,
          true
        )

        text.setValue(settings[fieldName]).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS[fieldName])
            component.onChanged()
          })
      })
  }

  createHideJournalFolderNotesSetting(
    settings: JournalFolderSettings
  ): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.hideJournalFolderNotes = value
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName('Hide journal-folder.md in file explorer')
      .setDesc(
        "Hides every 'journal-folder.md' note from Obsidian's built-in " +
          'file explorer. The notes still exist on disk and remain ' +
          'accessible via search and the sidebar.'
      )
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings.hideJournalFolderNotes).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.hideJournalFolderNotes)
            onChange(DEFAULT_SETTINGS.hideJournalFolderNotes)
          })
      })
  }

  createAutoTemplateEnabledSetting(settings: JournalFolderSettings): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.autoTemplateEnabled = value
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings).then(() => this.render())
    }

    return new Setting(this.containerEl)
      .setName('Auto-fill new journal notes')
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings.autoTemplateEnabled).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.autoTemplateEnabled)
            onChange(DEFAULT_SETTINGS.autoTemplateEnabled)
          })
      })
  }

  createQuartersEnabledSetting(settings: JournalFolderSettings): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.quartersEnabled = value
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings).then(() => this.render())
    }

    const setting = new Setting(this.containerEl)
    setting.settingEl.dataset.jfSetting = 'quartersEnabled'
    return setting
      .setName('Enable quarterly notes')
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings.quartersEnabled).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.quartersEnabled)
            onChange(DEFAULT_SETTINGS.quartersEnabled)
          })
      })
      .setDesc(
        'When enabled, notes named "YYYY-Q[1-4]" are recognised as quarterly ' +
          'journal notes and slot in between yearly and monthly tiers in ' +
          'navigation. The calendar picker also annotates each month title ' +
          'with the quarter (e.g. "January 2026 (Q1)"). Override per-folder ' +
          'by setting "quarters-enabled: true" or "quarters-enabled: false" ' +
          "in that folder's journal-folder.md front matter."
      )
  }

  createTodayButtonPlacementSetting(settings: JournalFolderSettings): Setting {
    let component: DropdownComponent

    const onChange = (value: string) => {
      settings.todayButtonPlacement = value as TodayButtonPlacement
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName("Today button placement")
      .setDesc(
        'Where the Today affordance appears. In menu — an item inside the ' +
          'existing Journal Folder ribbon menu. Top-level ribbon icon — its ' +
          'own icon in the ribbon. Off — hidden (the command still works).'
      )
      .addDropdown((dropdown) => {
        component = dropdown
        // eslint-disable-next-line obsidianmd/ui/sentence-case -- 'Journal Folder' is the plugin's own (proper) name
        dropdown.addOption('menu', 'In the Journal Folder menu')
        dropdown.addOption('ribbon', 'Top-level ribbon icon')
        dropdown.addOption('off', 'Off')
        dropdown.setValue(settings.todayButtonPlacement).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.todayButtonPlacement)
            onChange(DEFAULT_SETTINGS.todayButtonPlacement)
          })
      })
  }

  createIncludeInTodayPickerSetting(
    settings: JournalFolderSettings,
    isFolder: boolean
  ): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.includeInTodayPicker = value
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName(
        isFolder
          ? 'Include this folder in the Today picker'
          : 'Include folders in the Today picker by default'
      )
      .setDesc(
        'When the Today action has more than one eligible journal folder, it ' +
          'asks which one to open. A folder is offered only when this is on. ' +
          'Special cases: a single journal folder is always opened directly; ' +
          'if several folders exist but none opt in, all of them are offered. ' +
          (isFolder
            ? 'Overrides the global default for this folder via the ' +
              '"include-in-today-picker" front-matter key.'
            : 'Override per-folder in journal-folder.md front matter.')
      )
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings.includeInTodayPicker).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.includeInTodayPicker)
            onChange(DEFAULT_SETTINGS.includeInTodayPicker)
          })
      })
  }

  createUseFolderNameAsDefaultTitleSetting(
    settings: JournalFolderSettings
  ): Setting {
    const name = 'Use folder name as default folder title'
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.useFolderNameAsDefaultTitle = value
      if (value) settings.journalFolderTitle = ''
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings).then(() => this.render())
    }

    return new Setting(this.containerEl)
      .setName(name)
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings.useFolderNameAsDefaultTitle).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.useFolderNameAsDefaultTitle)
            onChange(DEFAULT_SETTINGS.useFolderNameAsDefaultTitle)
          })
      })
      .setDesc(
        'If this option is checked, and a journal folder title is not configured at ' +
          'folder level, the folder name will be used as title for the journal folder.'
      )
  }

  createStartOfWeekSetting(settings: JournalFolderSettings): Setting {
    let component: DropdownComponent

    const onChange = (value: string) => {
      settings.startOfWeek = value as StartOfWeekSetting
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings)
    }

    const setting = new Setting(this.containerEl)
    setting.settingEl.dataset.jfSetting = 'startOfWeek'
    return setting
      .setName('Start of week')
      .addDropdown((dropdown) => {
        component = dropdown
        Object.entries(START_OF_WEEK_OPTIONS).forEach(([value, label]) => {
          dropdown.addOption(value, label)
        })
        dropdown.setValue(settings.startOfWeek).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.startOfWeek)
            onChange(DEFAULT_SETTINGS.startOfWeek)
          })
      })
      .setDesc(
        'Controls the first day of the week. This affects both the calendar ' +
          "grid and the way weeks are numbered in 'gggg-[W]ww' weekly note " +
          "names. 'Locale default' leaves Obsidian's bundled moment locale " +
          'untouched. Selecting an explicit day overrides the locale so week ' +
          '1 of any year is the week containing January 1.'
      )
  }

  createFolderTaskFlowSection(settings: JournalFolderSettings): void {
    renderFolderTaskFlowSection({
      containerEl: this.containerEl,
      getSettings: () => settings,
      saveSettings: (next) => this.saveSettings(next),
    })
  }

  createTaskInteractionScopeSetting(
    settings: JournalFolderSettings
  ): Setting {
    let component: DropdownComponent

    const onChange = (value: string) => {
      settings.taskInteractionScope =
        value as JournalFolderSettings['taskInteractionScope']
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName('Cycle / render tasks')
      .setDesc(
        'Task lists only — wire the cycle and right-click status menu in ' +
          'the plugin’s own task panels (sidebar, tasks-only sidebar, ' +
          'in-note journal-tasks block) and leave document checkboxes to ' +
          'Obsidian. Everywhere — additionally intercept every task ' +
          'checkbox in the rendered document (reading view + live ' +
          'preview); switch back to Task lists only when another plugin ' +
          '(e.g. Tasks) is handling in-document interactions.'
      )
      .addDropdown((dropdown) => {
        component = dropdown
        dropdown.addOption('lists', 'Task lists only')
        dropdown.addOption('everywhere', 'Everywhere')
        dropdown.setValue(settings.taskInteractionScope).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.taskInteractionScope)
            onChange(DEFAULT_SETTINGS.taskInteractionScope)
          })
      })
  }

  createTaskClickOpensPickerSetting(settings: JournalFolderSettings): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.taskClickOpensPicker = value
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName('Left-click opens the status menu')
      .setDesc(
        'When on, left-clicking a task checkbox opens the status picker ' +
          '(the same menu as a right-click / long-press) instead of ' +
          'cycling to the next status. Right-click always opens the menu ' +
          'regardless.'
      )
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings.taskClickOpensPicker).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.taskClickOpensPicker)
            onChange(DEFAULT_SETTINGS.taskClickOpensPicker)
          })
      })
  }

  createTasksMaxItemsSetting(settings: JournalFolderSettings): Setting {
    let component: TextComponent

    const onChange = (raw: string) => {
      const parsed = parseInt(raw, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) return
      settings.tasksMaxItems = parsed
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName('Maximum tasks shown')
      .setDesc(
        'Hard cap on the number of tasks rendered in the sidebar and ' +
          'in-note blocks. When exceeded, a footer appears with a link ' +
          'back here to increase the limit.'
      )
      .addText((text) => {
        component = text
        text.setValue(String(settings.tasksMaxItems)).onChange(
          debounce(onChange, 250, true)
        )
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(String(DEFAULT_SETTINGS.tasksMaxItems))
            onChange(String(DEFAULT_SETTINGS.tasksMaxItems))
          })
      })
  }

  createDefaultCalendarVisibleSetting(
    settings: JournalFolderSettings,
    field: 'defaultCalendarVisibleDesktop' | 'defaultCalendarVisibleMobile',
    name: string
  ): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings[field] = value
      // noinspection JSIgnoredPromiseFromCall
      void this.saveSettings(settings)
    }

    const frontMatterKey =
      field === 'defaultCalendarVisibleDesktop'
        ? 'default-calendar-visible-desktop'
        : 'default-calendar-visible-mobile'

    return new Setting(this.containerEl)
      .setName(name)
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings[field]).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS[field])
            onChange(DEFAULT_SETTINGS[field])
          })
      })
      .setDesc(
        'If checked, the calendar picker is visible when Obsidian starts. ' +
          `Override per-folder by setting "${frontMatterKey}: true" or ` +
          `"${frontMatterKey}: false" in that folder's journal-folder.md ` +
          'front matter. The user can still toggle the calendar from the More ' +
          'popover at any time, and that manual choice persists for the rest ' +
          'of the running Obsidian session.'
      )
  }
}

// Tab definitions consumed by `SettingsFormBuilder.render()`. The
// declared order drives the tab strip's order. `isVisible` reflects
// the global-vs-folder split — folder mode (the per-folder modal)
// only shows the tabs whose content makes sense for a single folder.
const TABS: TabDef[] = [
  {
    id: 'general',
    label: 'General',
    isVisible: () => true,
    render: (builder, settings, isFolder) =>
      builder.renderGeneralTab(settings, isFolder),
  },
  {
    id: 'templates',
    label: 'New-note template',
    isVisible: () => true,
    render: (builder, settings, isFolder) =>
      builder.renderTemplatesTab(settings, isFolder),
  },
  {
    id: 'patterns',
    label: 'Note patterns',
    isVisible: () => true,
    render: (builder, settings) => builder.renderPatternsTab(settings),
  },
  {
    id: 'tasks',
    label: 'Tasks',
    isVisible: () => true,
    render: (builder, settings, isFolder) =>
      isFolder
        ? builder.renderFolderTasksTab(settings)
        : builder.renderTasksTab(settings),
  },
  {
    id: 'signifiers',
    label: 'Signifiers',
    isVisible: (isFolder) => !isFolder,
    render: (builder, settings) => builder.renderSignifiersTab(settings),
  },
  {
    id: 'reset',
    label: 'Reset',
    isVisible: (isFolder) => !isFolder,
    render: (builder) => builder.renderResetTab(),
  },
]

interface ConfirmModalOptions {
  title: string
  message: string
  confirmText: string
  onConfirm: () => void
}

class ConfirmModal extends Modal {
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
      .setWarning() // eslint-disable-line @typescript-eslint/no-deprecated -- setDestructive needs Obsidian 1.13.0 (> our 1.7.2 floor); revisit when minAppVersion is raised
      .onClick(() => {
        this.close()
        this.options.onConfirm()
      })
  }

  onClose() {
    this.contentEl.empty()
  }
}
