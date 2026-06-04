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
  type Plugin,
  PluginSettingTab,
  setIcon,
  Setting,
  TextComponent,
  ToggleComponent,
} from 'obsidian'
import {
  BUILTIN_TEMPLATES,
  BUILTIN_TEMPLATE_LABELS,
  type BuiltInTemplateId,
  cloneTemplate,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATE_ID,
  isBuiltInTemplate,
  type JournalFolderSettings,
  LUCIDE_MARKER_PREFIX,
  MIGRATION_REFERENCE_PRESETS,
  type StartOfWeekSetting,
  type TaskMigrationPlacement,
  type TaskMigrationReferenceStyle,
  type TaskStatus,
} from '../../data-access'
import { DEFAULT_AUTO_TEMPLATE } from '../journal-auto-template'
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

type AutoTemplateField =
  | 'autoTemplateContent'
  | 'dailyNoteAutoTemplateContent'
  | 'weeklyNoteAutoTemplateContent'
  | 'monthlyNoteAutoTemplateContent'
  | 'quarterlyNoteAutoTemplateContent'
  | 'yearlyNoteAutoTemplateContent'

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
type TabId = 'general' | 'templates' | 'patterns' | 'tasks' | 'reset'

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
      if (tab.id === this.activeTab) btn.addClass('is-active')
      btn.onclick = (e) => {
        e.preventDefault()
        this.activeTab = tab.id
        this.render()
      }
    }

    // ---- active tab content -------------------------------------
    this.tabContentEl = root.createDiv({ cls: 'jf-settings-tab-panel' })
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

  renderTemplatesTab(settings: JournalFolderSettings): void {
    new Setting(this.containerEl).setName('New-note template').setHeading()
      .setDesc(
        "When enabled, newly created notes whose names match a journal " +
          "pattern (e.g. 2026-05-07, 2026-W19, 2026-05, 2026-Q2, 2026) and " +
          "that live in a folder containing a 'journal-folder.md' note are " +
          "automatically seeded with a template body. Disable per-folder by " +
          "adding 'auto-template-enabled: false' to that folder's " +
          "journal-folder.md front matter, and override the template body " +
          "per-folder by writing markdown into the body of journal-folder.md."
      )
    this.createAutoTemplateEnabledSetting(settings)
    if (settings.autoTemplateEnabled) {
      this.createAutoTemplatePerTierSetting(settings)
      if (settings.autoTemplatePerTier) {
        this.createAutoTemplateContentSetting(
          settings,
          'dailyNoteAutoTemplateContent',
          'Daily note template',
          'Used for new daily notes (YYYY-MM-DD). Leave blank for the ' +
            'built-in default (shown as placeholder).'
        )
        this.createAutoTemplateContentSetting(
          settings,
          'weeklyNoteAutoTemplateContent',
          'Weekly note template',
          'Used for new weekly notes (gggg-[W]ww). Leave blank for the ' +
            'built-in default (shown as placeholder).'
        )
        this.createAutoTemplateContentSetting(
          settings,
          'monthlyNoteAutoTemplateContent',
          'Monthly note template',
          'Used for new monthly notes (YYYY-MM). Leave blank for the ' +
            'built-in default (shown as placeholder).'
        )
        if (settings.quartersEnabled) {
          this.createAutoTemplateContentSetting(
            settings,
            'quarterlyNoteAutoTemplateContent',
            'Quarterly note template',
            'Used for new quarterly notes (YYYY-Q[1-4]). Leave blank for ' +
              'the built-in default (shown as placeholder).'
          )
        }
        this.createAutoTemplateContentSetting(
          settings,
          'yearlyNoteAutoTemplateContent',
          'Yearly note template',
          'Used for new yearly notes (YYYY). Leave blank for the ' +
            'built-in default (shown as placeholder).'
        )
      } else {
        this.createAutoTemplateContentSetting(
          settings,
          'autoTemplateContent',
          'Default template',
          "Markdown used to seed every new journal note. Leave blank " +
            "for the built-in default (shown as placeholder). Per-folder " +
            "overrides go in the body of that folder's journal-folder.md " +
            "note."
        )
      }
    }
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

  private renderTasksPreviewNotice(): void {
    const notice = this.containerEl.createDiv({
      cls: 'jf-tasks-preview-notice',
    })
    notice.createDiv({
      cls: 'jf-tasks-preview-notice-title',
      text: 'Preview feature',
    })
    const body = notice.createDiv({ cls: 'jf-tasks-preview-notice-body' })
    body.appendText(
      'Task management is a new capability still in active development ' +
        'and shipped as a preview. Behaviour, settings keys, and ' +
        'persisted data shapes may change between releases — your ' +
        'configured flows and statuses could need to be re-created. ' +
        'New installs default to '
    )
    body.createEl('strong', { text: 'task lists only' })
    body.appendText(
      ' so document-body checkboxes stay on Obsidian’s native ' +
        'behaviour; opt in to ' +
        'everywhere only if you understand the trade-off.'
    )
  }

  renderTasksTab(settings: JournalFolderSettings): void {
    this.renderTasksPreviewNotice()
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
    this.renderTasksPreviewNotice()
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
            onPlacement(DEFAULT_SETTINGS.taskMigrationPlacement)
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
              this.saveSettings(settings)
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
          .setDynamicTooltip()
          .onChange((value) => {
            settings.taskMigrationReferenceOpacity = value
            // noinspection JSIgnoredPromiseFromCall
            this.saveSettings(settings)
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
          this.saveSettings(settings)
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
          .setWarning()
          .onClick(() => {
            new ConfirmModal(this.plugin.app, {
              title: 'Reset all settings?',
              message:
                'Every setting on this screen will be restored to its ' +
                'default value. This cannot be undone.',
              confirmText: 'Reset',
              onConfirm: () => {
                // noinspection JSIgnoredPromiseFromCall
                this.saveSettings(DEFAULT_SETTINGS).then(() => this.render())
              },
            }).open()
          })
      })
  }

  createPatternsHeading() {
    const desc = document.createDocumentFragment()
    desc.append(
      'Date format strings used to render note titles and links. Each ' +
        "pattern should not render units shorter than its tier (e.g. don't " +
        'use day components in a monthly pattern). '
    )
    const link = document.createElement('a')
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
    const sampleValueEl = document.createElement('div')
    sampleValueEl.addClass('journal-folder-config-sample-value')

    const setting = new Setting(this.containerEl)
      .setName(name)
      .addMomentFormat((text) => {
        component = text
        const onChange = debounce(
          (value: string) => {
            settings[fieldName] = value
            // noinspection JSIgnoredPromiseFromCall
            this.saveSettings(settings)
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

    const sampleEl = document.createElement('div')
    sampleEl.addClass('journal-folder-config-hints-row')

    const sampleLabelEl = document.createElement('div')
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
    let component: TextComponent

    return setting
      .setName(name)
      .addText((text) => {
        component = text
        const onChange = debounce(
          (value: string) => {
            settings[fieldName] = value
            // noinspection JSIgnoredPromiseFromCall
            this.saveSettings(settings)
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
      this.saveSettings(settings)
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
      this.saveSettings(settings).then(() => this.render())
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

  createAutoTemplatePerTierSetting(settings: JournalFolderSettings): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.autoTemplatePerTier = value
      // noinspection JSIgnoredPromiseFromCall
      this.saveSettings(settings).then(() => this.render())
    }

    return new Setting(this.containerEl)
      .setName('Use a different template per note type')
      .setDesc(
        'Off — every new journal note (daily, weekly, monthly, ' +
          'quarterly, yearly) is seeded with the same default template. ' +
          'On — pick a separate template for each note type. The two ' +
          'modes are mutually exclusive.'
      )
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings.autoTemplatePerTier).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.autoTemplatePerTier)
            onChange(DEFAULT_SETTINGS.autoTemplatePerTier)
          })
      })
  }

  createAutoTemplateContentSetting(
    settings: JournalFolderSettings,
    field: AutoTemplateField,
    name: string,
    desc: string
  ): Setting {
    // Standard Obsidian Setting rows place the control on the right, which
    // gives a textarea ~30% of the row width — useless for editing markdown.
    // Render the name/desc as a normal Setting, then append a separate
    // full-width row containing a plain <textarea>. The placeholder shows
    // the effective fallback (the generic default template, or the
    // built-in template) so users see what they'll get if they leave the
    // field blank.
    const setting = new Setting(this.containerEl).setName(name).setDesc(desc)

    const wrapper = this.containerEl.createDiv({
      cls: 'journal-folder-config-template-wrapper',
    })
    const textarea = wrapper.createEl('textarea', {
      cls: 'journal-folder-config-template-textarea',
    })
    textarea.rows = 8
    textarea.placeholder = DEFAULT_AUTO_TEMPLATE
    textarea.value = settings[field]

    const onChange = debounce(
      (value: string) => {
        settings[field] = value
        // noinspection JSIgnoredPromiseFromCall
        this.saveSettings(settings)
      },
      250,
      true
    )
    textarea.addEventListener('input', () => onChange(textarea.value))

    return setting
  }

  createQuartersEnabledSetting(settings: JournalFolderSettings): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.quartersEnabled = value
      // noinspection JSIgnoredPromiseFromCall
      this.saveSettings(settings).then(() => this.render())
    }

    return new Setting(this.containerEl)
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

  createUseFolderNameAsDefaultTitleSetting(
    settings: JournalFolderSettings
  ): Setting {
    const name = 'Use folder name as default folder title'
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.useFolderNameAsDefaultTitle = value
      if (value) settings.journalFolderTitle = ''
      // noinspection JSIgnoredPromiseFromCall
      this.saveSettings(settings).then(() => this.render())
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
      this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
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
      this.saveSettings(settings)
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

  createTasksMaxItemsSetting(settings: JournalFolderSettings): Setting {
    let component: TextComponent

    const onChange = (raw: string) => {
      const parsed = parseInt(raw, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) return
      settings.tasksMaxItems = parsed
      // noinspection JSIgnoredPromiseFromCall
      this.saveSettings(settings)
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
      this.saveSettings(settings)
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
    render: (builder, settings) => builder.renderTemplatesTab(settings),
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
      .setWarning()
      .onClick(() => {
        this.close()
        this.options.onConfirm()
      })
  }

  onClose() {
    this.contentEl.empty()
  }
}
