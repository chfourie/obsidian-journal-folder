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
  debounce,
  MomentFormatComponent,
  type Plugin,
  PluginSettingTab,
  Setting,
  TextComponent,
  ToggleComponent,
} from 'obsidian'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../../data-access'

type SettingsStringFieldName =
  | 'dailyNoteTitlePattern'
  | 'dailyNoteShortTitlePattern'
  | 'weeklyNoteTitlePattern'
  | 'weeklyNoteShortTitlePattern'
  | 'monthlyNoteTitlePattern'
  | 'monthlyNoteShortTitlePattern'
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

    this.createMomentSetting(
      settings,
      'dailyNoteTitlePattern',
      'Daily note title pattern'
    ).setDesc(
      'The pattern used to render the title of a daily note. ' +
        'This pattern should not render any date/time elements shorter than a day (e.g. hour or minute). ' +
        "For instance, using a pattern of 'DD-HH' would not make sense " +
        'as the hour component represents a fraction of the day. ' +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'dailyNoteShortTitlePattern',
      'Daily note short title pattern'
    ).setDesc(
      'The pattern used to render links to daily notes. The user should aim to keep this pattern short ' +
        'as multiple links may be rendered next to each other. ' +
        'This pattern should not render any date/time elements shorter than a day (e.g. hour or minute). ' +
        "For instance, using a pattern of 'DD-HH' would not make sense " +
        'as the hour component represents a fraction of the day. ' +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'dailyNoteMediumTitlePattern',
      'Daily note medium title pattern'
    ).setDesc(
      'The pattern used to render links to daily notes where the destination note falls in a different ' +
        'year then the current note. The user should aim to keep this pattern short ' +
        'as multiple links may be rendered next to each other. ' +
        'This pattern should not render any date/time elements shorter than a day (e.g. hour or minute). ' +
        "For instance, using a pattern of 'DD-HH' would not make sense " +
        'as the hour component represents a fraction of the day. ' +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'weeklyNoteTitlePattern',
      'Weekly note title pattern'
    ).setDesc(
      'The pattern used to render the title of a weekly note. ' +
        'This pattern should not render any date/time elements shorter than a week (e.g. day or hour). ' +
        "For instance, using a pattern of 'WW-DD' would not make sense " +
        'as the day component represents a fraction of the week. ' +
        "PLEASE NOTE: for weekly patterns 'gg' or 'gggg' should be used to reflect the year. " +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'weeklyNoteShortTitlePattern',
      'Weekly note short title pattern'
    ).setDesc(
      'The pattern used to render links to weekly notes. The user should aim to keep this pattern short ' +
        'as multiple links may be rendered next to each other. ' +
        'This pattern should not render any date/time elements shorter than a week (e.g. day or hour). ' +
        "For instance, using a pattern of 'WW-DD' would not make sense " +
        'as the day component represents a fraction of the week. ' +
        "PLEASE NOTE: for weekly patterns 'gg' or 'gggg' should be used to reflect the year. " +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'weeklyNoteMediumTitlePattern',
      'Weekly note medium title pattern'
    ).setDesc(
      'The pattern used to render links to weekly notes where the destination note falls in a different ' +
        'year then the current note. The user should aim to keep this pattern short ' +
        'as multiple links may be rendered next to each other. ' +
        'This pattern should not render any date/time elements shorter than a week (e.g. day or hour). ' +
        "For instance, using a pattern of 'WW-DD' would not make sense " +
        'as the day component represents a fraction of the week. ' +
        "PLEASE NOTE: for weekly patterns 'gg' or 'gggg' should be used to reflect the year. " +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'monthlyNoteTitlePattern',
      'Monthly note title pattern'
    ).setDesc(
      'The pattern used to render the title of a monthly note. ' +
        'This pattern should not render any date/time elements shorter than a month (e.g. week or day). ' +
        "For instance, using a pattern of 'MM-DD' would not make sense " +
        'as the day component represents a fraction of the month. ' +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'monthlyNoteShortTitlePattern',
      'Monthly note short title pattern'
    ).setDesc(
      'The pattern used to render links to monthly notes. The user should aim to keep this pattern short ' +
        'as multiple links may be rendered next to each other. ' +
        'This pattern should not render any date/time elements shorter than a month (e.g. week or day). ' +
        "For instance, using a pattern of 'MM-DD' would not make sense " +
        'as the day component represents a fraction of the month. ' +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'monthlyNoteMediumTitlePattern',
      'Monthly note medium title pattern'
    ).setDesc(
      'The pattern used to render links to monthly notes where the destination note falls in a different ' +
        'year then the current note. The user should aim to keep this pattern short ' +
        'as multiple links may be rendered next to each other. ' +
        'This pattern should not render any date/time elements shorter than a month (e.g. week or day). ' +
        "For instance, using a pattern of 'MM-DD' would not make sense " +
        'as the day component represents a fraction of the month. ' +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'yearlyNoteTitlePattern',
      'Yearly note title pattern'
    ).setDesc(
      'The pattern used to render the title of a yearly note. ' +
        'This pattern should not render any date/time elements shorter than a year (e.g. month, week or day). ' +
        "For instance, using a pattern of 'YYYY-MM' would not make sense " +
        'as the month component represents a fraction of the year. ' +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createMomentSetting(
      settings,
      'yearlyNoteShortTitlePattern',
      'Yearly note short title pattern'
    ).setDesc(
      'The pattern used to render links to yearly notes. The user should aim to keep this pattern short ' +
        'as multiple links may be rendered next to each other. ' +
        'This pattern should not render any date/time elements shorter than a year (e.g. month, week or day). ' +
        "For instance, using a pattern of 'YYYY-MM' would not make sense " +
        'as the month component represents a fraction of the year. ' +
        'For help on the pattern syntax, refer to the link below.'
    )

    this.createUseFolderNameAsDefaultTitleSetting(settings)

    if (!settings.useFolderNameAsDefaultTitle) {
      this.createTextSetting(
        settings,
        'journalFolderTitle',
        'Default journal folder title'
      ).setDesc(
        'The default title assigned to journal folders.  The journal folder title ' +
          'is used in the rendering of journal headers as well as to identify the ' +
          'folder in other views. The journal folder title should typically be ' +
          'configured at folder level as it would typically be unique to that ' +
          'folder.  The user is however provided the option to assign a default ' +
          'value here.  For most users it would make most sense, and it is ' +
          'highly recommended to leave this value blank.'
      )
    }

    new Setting(this.containerEl)
      .setName('Reset all to default values')
      .addButton((btn) => {
        btn
          .setIcon('reset')
          .setWarning()
          .onClick(() => {
            // noinspection JSIgnoredPromiseFromCall
            this.saveSettings(DEFAULT_SETTINGS).then(() => this.display())
          })
      })
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

    const helpLinkEl = document.createElement('a')
    helpLinkEl.setAttribute(
      'href',
      'https://momentjs.com/docs/#/displaying/format/'
    )
    helpLinkEl.innerText = 'Pattern syntax reference'
    helpLinkEl.addClass('journal-folder-config-syntax-reference-link')

    const sampleLabelEl = document.createElement('div')
    sampleLabelEl.addClass('journal-folder-config-sample-label')
    sampleLabelEl.setText('Sample value:')

    sampleEl.appendChild(helpLinkEl)
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
}
