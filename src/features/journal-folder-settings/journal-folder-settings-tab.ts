import { type Plugin, PluginSettingTab, Setting } from 'obsidian'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../../data-access'

type SettingsStringFieldName = 'dailyNoteTitlePattern' | 'dailyNoteShortTitlePattern' | 'weeklyNoteTitlePattern'
	| 'weeklyNoteShortTitlePattern' | 'monthlyNoteTitlePattern' | 'monthlyNoteShortTitlePattern'
	| 'yearlyNoteTitlePattern' | 'yearlyNoteShortTitlePattern'

export class JournalFolderSettingsTab extends PluginSettingTab {
	constructor(
		private plugin: Plugin,
		private getCurrentSettings: () => JournalFolderSettings,
		private saveSettings: (settings: JournalFolderSettings) => Promise<void>,
	) {
		super(plugin.app, plugin)
	}

	display() {
		const settings = { ...this.getCurrentSettings() }

		this.createMomentSetting(settings, 'dailyNoteTitlePattern', 'Daily note title pattern')
		this.createMomentSetting(settings, 'dailyNoteShortTitlePattern', 'Daily note short title pattern')
		this.createMomentSetting(settings, 'weeklyNoteTitlePattern', 'Weekly note title pattern')
		this.createMomentSetting(settings, 'weeklyNoteShortTitlePattern', 'Weekly note short title pattern')
		this.createMomentSetting(settings, 'monthlyNoteTitlePattern', 'Monthly note title pattern')
		this.createMomentSetting(settings, 'monthlyNoteShortTitlePattern', 'Monthly note short title pattern')
		this.createMomentSetting(settings, 'yearlyNoteTitlePattern', 'Yearly note title pattern')
		this.createMomentSetting(settings, 'yearlyNoteShortTitlePattern', 'Yearly note short title pattern')
	}

	createMomentSetting(settings: JournalFolderSettings, fieldName: SettingsStringFieldName, name: string): Setting {
		const sampleEl = document.createElement('div')

		const setting = new Setting(this.containerEl)
			.setName(name)
			.addMomentFormat(text => {
				text.setDefaultFormat(DEFAULT_SETTINGS[fieldName])
				text.setValue(settings[fieldName])
					// .setPlaceholder(DEFAULT_SETTINGS[fieldName])
					.onChange(async (value) => {
						settings[fieldName] = value
						await this.saveSettings(settings)
					})
				text.setSampleEl(sampleEl)
			})

		this.containerEl.appendChild(sampleEl)
		return setting
	}
}
