import { PluginSettingTab, Setting, TextComponent } from 'obsidian'
import JournalFolderPlugin from './journal-folder-plugin'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../data-access'

type SettingsStringFieldName = 'dailyNoteTitlePattern' | 'dailyNoteShortTitlePattern' | 'weeklyNoteTitlePattern'
	| 'weeklyNoteShortTitlePattern' | 'monthlyNoteTitlePattern' | 'monthlyNoteShortTitlePattern'
	| 'yearlyNoteTitlePattern' | 'yearlyNoteShortTitlePattern'

export class JournalFolderSettingsTab extends PluginSettingTab {
	constructor(private plugin: JournalFolderPlugin) {
		super(plugin.app, plugin)
	}

	private get settings() : JournalFolderSettings {
		return this.plugin.settings
	}

	display(): void {
		this.containerEl.empty()
		this.createTextSetting('dailyNoteTitlePattern', 'Daily note title pattern')
		this.createMomentSetting('dailyNoteShortTitlePattern', 'Daily note short title pattern')
	}

	createTextSetting(fieldName: SettingsStringFieldName, name: string): Setting {
		let textComponent: TextComponent

		return new Setting(this.containerEl)
			.setName(name)
			.addText(text => {
				textComponent = text
				text.setValue(this.settings[fieldName])
					.setPlaceholder(DEFAULT_SETTINGS[fieldName])
					.onChange(async (value) => {
						console.log('value', value)
						this.settings[fieldName] = value
						await this.plugin.saveSettings()
					})
			})
			.addExtraButton(btn => {
				btn.setIcon('reset')
					.setTooltip('Reset to default value')
					.onClick(() => {
						textComponent.setValue(DEFAULT_SETTINGS[fieldName])
						textComponent.onChanged()
					})
			})
	}

	createMomentSetting(fieldName: SettingsStringFieldName, name: string): Setting {
		const sampleEl = document.createElement('div')

		const setting = new Setting(this.containerEl)
			.setName(name)
			.addMomentFormat(text => {
				text.setDefaultFormat(DEFAULT_SETTINGS[fieldName])
				text.setValue(this.settings[fieldName])
					// .setPlaceholder(DEFAULT_SETTINGS[fieldName])
					.onChange(async (value) => {
						this.settings[fieldName] = value
						await this.plugin.saveSettings()
					})
				text.setSampleEl(sampleEl)
			})

		this.containerEl.appendChild(sampleEl)
		return setting
	}
}
