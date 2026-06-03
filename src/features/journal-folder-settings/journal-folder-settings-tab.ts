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
  Setting,
  TextComponent,
  ToggleComponent,
} from 'obsidian'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
  type StartOfWeekSetting,
} from '../../data-access'
import { DEFAULT_AUTO_TEMPLATE } from '../journal-auto-template'

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

class SettingsFormBuilder {
  constructor(private config: SettingsFormConfig) {}

  private get containerEl(): HTMLElement {
    return this.config.containerEl
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
    this.containerEl.empty()
    const settings = { ...this.getCurrentSettings() }
    const isFolder = this.config.mode === 'folder'

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

    if (!isFolder) {
      new Setting(this.containerEl)
        .setName('Tasks')
        .setHeading()
        .setDesc(
          'Surfaces Markdown tasks from journal notes in the sidebar and via ' +
            'the journal-tasks code block. The Today / Dynamic and ' +
            'Show / Hide completed quick toggles live on the sidebar itself ' +
            '— this section only carries settings that don’t have a sidebar ' +
            'home.'
        )
      this.createTasksSidebarEnabledSetting(settings)
      this.createTaskModelSetting(settings)
      this.createTaskCheckboxStyleSetting(settings)
      this.createTasksMaxItemsSetting(settings)
      this.createDocumentTasksEnabledSetting(settings)
      this.createTaskCheckboxRenderingSetting(settings)

      new Setting(this.containerEl).setName('Reset').setHeading()
      new Setting(this.containerEl)
        .setName('Reset all to default values')
        .setDesc('Restores every setting on this screen to its default.')
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

  createTasksSidebarEnabledSetting(settings: JournalFolderSettings): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.tasksSidebarEnabled = value
      // noinspection JSIgnoredPromiseFromCall
      this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName('Show task panel in sidebar')
      .setDesc(
        'When enabled, the sidebar gains a Tasks panel below the calendar ' +
          'that lists open tasks in the current reference range.'
      )
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings.tasksSidebarEnabled).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.tasksSidebarEnabled)
            onChange(DEFAULT_SETTINGS.tasksSidebarEnabled)
          })
      })
  }

  createTaskModelSetting(settings: JournalFolderSettings): Setting {
    let component: DropdownComponent

    const onChange = (value: string) => {
      settings.taskModel = value as JournalFolderSettings['taskModel']
      // noinspection JSIgnoredPromiseFromCall
      this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName('Task model')
      .setDesc(
        'Simple — only [ ] open and [x] done. Bullet Journal — adds ' +
          '[/] in progress, [>] migrated, [-] cancelled. Switching is ' +
          'non-destructive: both models share the community-conventional ' +
          'checkbox alphabet.'
      )
      .addDropdown((dropdown) => {
        component = dropdown
        dropdown.addOption('simple', 'Simple')
        dropdown.addOption('bullet-journal', 'Bullet Journal')
        dropdown.setValue(settings.taskModel).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.taskModel)
            onChange(DEFAULT_SETTINGS.taskModel)
          })
      })
  }

  createTaskCheckboxStyleSetting(settings: JournalFolderSettings): Setting {
    let component: DropdownComponent

    const onChange = (value: string) => {
      settings.taskCheckboxStyle =
        value as JournalFolderSettings['taskCheckboxStyle']
      // noinspection JSIgnoredPromiseFromCall
      this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName('Checkbox style')
      .setDesc('Pick between square and circle status icons.')
      .addDropdown((dropdown) => {
        component = dropdown
        dropdown.addOption('square', 'Square')
        dropdown.addOption('circle', 'Circle')
        dropdown.setValue(settings.taskCheckboxStyle).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.taskCheckboxStyle)
            onChange(DEFAULT_SETTINGS.taskCheckboxStyle)
          })
      })
  }

  createDocumentTasksEnabledSetting(
    settings: JournalFolderSettings
  ): Setting {
    let component: ToggleComponent

    const onChange = (value: boolean) => {
      settings.documentTasksEnabled = value
      // noinspection JSIgnoredPromiseFromCall
      this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName('Cycle / render document tasks')
      .setDesc(
        'When on, every task checkbox in the rendered document gets the ' +
          'same status icon and cycle / right-click menu the sidebar uses. ' +
          'Leave off to defer to Obsidian’s built-in checkboxes (or the ' +
          'Tasks plugin) for in-document interactions.'
      )
      .addToggle((toggle) => {
        component = toggle
        toggle.setValue(settings.documentTasksEnabled).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.documentTasksEnabled)
            onChange(DEFAULT_SETTINGS.documentTasksEnabled)
          })
      })
  }

  createTaskCheckboxRenderingSetting(
    settings: JournalFolderSettings
  ): Setting {
    let component: DropdownComponent

    const onChange = (value: string) => {
      settings.taskCheckboxRendering =
        value as JournalFolderSettings['taskCheckboxRendering']
      // noinspection JSIgnoredPromiseFromCall
      this.saveSettings(settings)
    }

    return new Setting(this.containerEl)
      .setName('Status icon rendering')
      .setDesc(
        'Plugin icons — replace every checkbox with the plugin’s Lucide ' +
          'icon (consistent across themes; bullet-journal statuses always ' +
          'render correctly). Theme checkbox — leave Obsidian’s native ' +
          'checkbox visible so the active theme styles it; the plugin still ' +
          'owns left-click cycle + right-click menu. No effect when the ' +
          'document-task toggle above is off.'
      )
      .addDropdown((dropdown) => {
        component = dropdown
        dropdown.addOption('plugin', 'Plugin icons')
        dropdown.addOption('theme', 'Theme checkbox')
        dropdown.setValue(settings.taskCheckboxRendering).onChange(onChange)
      })
      .addExtraButton((btn) => {
        btn
          .setIcon('reset')
          .setTooltip('Reset to default value')
          .onClick(() => {
            component.setValue(DEFAULT_SETTINGS.taskCheckboxRendering)
            onChange(DEFAULT_SETTINGS.taskCheckboxRendering)
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
