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
    this.containerEl.empty()
    const settings = { ...this.getCurrentSettings() }

    new Setting(this.containerEl).setName('General').setHeading()
    this.createUseFolderNameAsDefaultTitleSetting(settings)
    if (!settings.useFolderNameAsDefaultTitle) {
      this.createTextSetting(
        settings,
        'journalFolderTitle',
        'Default journal folder title'
      ).setDesc(
        'Used in the rendering of journal headers and to identify the folder ' +
          'in other views. Typically configured per folder via front matter; ' +
          'most users should leave this blank.'
      )
    }
    this.createStartOfWeekSetting(settings)
    this.createQuartersEnabledSetting(settings)

    new Setting(this.containerEl).setName('Sidebar').setHeading().setDesc(
      'The sidebar tab is the entry point for journaling-related actions ' +
        '(folder picker, calendar, configuration editor, initialise). Open ' +
        'it via the calendar ribbon icon.'
    )
    this.createHideJournalFolderNotesSetting(settings)

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
      this.createAutoTemplateContentSetting(settings)
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
                this.saveSettings(DEFAULT_SETTINGS).then(() => this.display())
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
      this.saveSettings(settings).then(() => this.display())
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

  createAutoTemplateContentSetting(settings: JournalFolderSettings): Setting {
    // Standard Obsidian Setting rows place the control on the right, which
    // gives a textarea ~30% of the row width — useless for editing markdown.
    // Render the name/desc as a normal Setting, then append a separate
    // full-width row containing a plain <textarea>. The placeholder shows
    // the built-in default in the muted placeholder colour so users see
    // what they'll get if they leave the field blank.
    const setting = new Setting(this.containerEl)
      .setName('Default template')
      .setDesc(
        "Markdown used to seed new journal notes. Leave blank for the " +
          "built-in default (shown as placeholder). Per-folder overrides " +
          "go in the body of that folder's journal-folder.md note."
      )

    const wrapper = this.containerEl.createDiv({
      cls: 'journal-folder-config-template-wrapper',
    })
    const textarea = wrapper.createEl('textarea', {
      cls: 'journal-folder-config-template-textarea',
    })
    textarea.rows = 8
    textarea.placeholder = DEFAULT_AUTO_TEMPLATE
    textarea.value = settings.autoTemplateContent

    const onChange = debounce(
      (value: string) => {
        settings.autoTemplateContent = value
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
      this.saveSettings(settings).then(() => this.display())
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
      this.saveSettings(settings).then(() => this.display())
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
