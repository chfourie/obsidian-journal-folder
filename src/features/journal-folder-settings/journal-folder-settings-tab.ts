import { debounce, MomentFormatComponent, type Plugin, PluginSettingTab, Setting } from 'obsidian'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../../data-access'

type SettingsStringFieldName = 'dailyNoteTitlePattern' | 'dailyNoteShortTitlePattern' | 'weeklyNoteTitlePattern'
	| 'weeklyNoteShortTitlePattern' | 'monthlyNoteTitlePattern' | 'monthlyNoteShortTitlePattern'
	| 'yearlyNoteTitlePattern' | 'yearlyNoteShortTitlePattern'

/***************************************************************************************************
 ** NOTE: This class has been slapped together in order to get the plugin released into the wild. **
 ** It does the job, but will be replaced with a more refined version somewhere in the future.    **
 ** ************************************************************************************************/
export class JournalFolderSettingsTab extends PluginSettingTab {
	constructor(
		private plugin: Plugin,
		private getCurrentSettings: () => JournalFolderSettings,
		private saveSettings: (settings: JournalFolderSettings) => Promise<void>,
	) {
		super(plugin.app, plugin)
	}

	display() {
		this.containerEl.empty()
		const settings = { ...this.getCurrentSettings() }

		const headingEl = document.createElement('h1')
		headingEl.innerText = 'Journal Folder Settings'
		this.containerEl.appendChild(headingEl)

		this.createMomentSetting(settings, 'dailyNoteTitlePattern', 'Daily note title pattern')
			.setDesc(
				"The pattern used to render the title of a daily note. " +
				"This pattern should not render any date/time elements shorter than a day (e.g. hour or minute). " +
				"For instance, using a pattern of 'WW-HH' would not make sense " +
				"as the hour component represents a fraction of the day. " +
				"For help on the pattern syntax, refer to the link below."
			)

		this.createMomentSetting(settings, 'dailyNoteShortTitlePattern', 'Daily note short title pattern')
			.setDesc(
				"The pattern used to render links to daily notes. The user should aim to keep this pattern short " +
				"as multiple links may be rendered next to each other. " +
				"This pattern should not render any date/time elements shorter than a day (e.g. hour or minute). " +
				"For instance, using a pattern of 'WW-HH' would not make sense " +
				"as the hour component represents a fraction of the day. " +
				"For help on the pattern syntax, refer to the link below."
			)

		this.createMomentSetting(settings, 'weeklyNoteTitlePattern', 'Weekly note title pattern')
			.setDesc(
				"The pattern used to render the title of a weekly note. " +
				"This pattern should not render any date/time elements shorter than a week (e.g. day or hour). " +
				"For instance, using a pattern of 'WW-DD' would not make sense " +
				"as the day component represents a fraction of the week. " +
				"For help on the pattern syntax, refer to the link below."
			)

		this.createMomentSetting(settings, 'weeklyNoteShortTitlePattern', 'Weekly note short title pattern')
			.setDesc(
				"The pattern used to render links to weekly notes. The user should aim to keep this pattern short " +
				"as multiple links may be rendered next to each other. " +
				"This pattern should not render any date/time elements shorter than a week (e.g. day or hour). " +
				"For instance, using a pattern of 'WW-DD' would not make sense " +
				"as the day component represents a fraction of the week. " +
				"For help on the pattern syntax, refer to the link below."
			)

		this.createMomentSetting(settings, 'monthlyNoteTitlePattern', 'Monthly note title pattern')
			.setDesc(
				"The pattern used to render the title of a monthly note. " +
				"This pattern should not render any date/time elements shorter than a month (e.g. week or day). " +
				"For instance, using a pattern of 'MM-DD' would not make sense " +
				"as the day component represents a fraction of the month. " +
				"For help on the pattern syntax, refer to the link below."
			)

		this.createMomentSetting(settings, 'monthlyNoteShortTitlePattern', 'Monthly note short title pattern')
			.setDesc(
				"The pattern used to render links to monthly notes. The user should aim to keep this pattern short " +
				"as multiple links may be rendered next to each other. " +
				"This pattern should not render any date/time elements shorter than a month (e.g. week or day). " +
				"For instance, using a pattern of 'MM-DD' would not make sense " +
				"as the day component represents a fraction of the month. " +
				"For help on the pattern syntax, refer to the link below."
			)

		this.createMomentSetting(settings, 'yearlyNoteTitlePattern', 'Yearly note title pattern')
			.setDesc(
				"The pattern used to render the title of a yearly note. " +
				"This pattern should not render any date/time elements shorter than a year (e.g. month, week or day). " +
				"For instance, using a pattern of 'YYYY-MM' would not make sense " +
				"as the month component represents a fraction of the year. " +
				"For help on the pattern syntax, refer to the link below."
			)

		this.createMomentSetting(settings, 'yearlyNoteShortTitlePattern', 'Yearly note short title pattern')
			.setDesc(
				"The pattern used to render links to yearly notes. The user should aim to keep this pattern short " +
				"as multiple links may be rendered next to each other. " +
				"This pattern should not render any date/time elements shorter than a year (e.g. month, week or day). " +
				"For instance, using a pattern of 'YYYY-MM' would not make sense " +
				"as the month component represents a fraction of the year. " +
				"For help on the pattern syntax, refer to the link below."
			)

		new Setting(this.containerEl)
			.setName("Reset all to default values")
			.addButton(btn => {
				btn.setIcon('reset')
					.setWarning()
					.onClick(() => {
						// noinspection JSIgnoredPromiseFromCall
						this.saveSettings(DEFAULT_SETTINGS).then(() => this.display())
					})
			})
	}

	createMomentSetting(settings: JournalFolderSettings, fieldName: SettingsStringFieldName, name: string): Setting {
		let component: MomentFormatComponent
		const sampleValueEl = document.createElement('div')
		sampleValueEl.setAttr('style', 'opacity: 50%')

		const setting = new Setting(this.containerEl)
			.setName(name)
			.addMomentFormat(text => {
				component = text
				const onChange = debounce(
					(value: string) => {
						settings[fieldName] = value
						// noinspection JSIgnoredPromiseFromCall
						this.saveSettings(settings)
					}, 250, true,
				)

				text.setDefaultFormat(DEFAULT_SETTINGS[fieldName])
				text.setValue(settings[fieldName])
					.onChange(onChange)
				text.setSampleEl(sampleValueEl)
			})
			.addExtraButton(btn => {
				btn.setIcon('reset')
					.setTooltip('Reset to default value')
					.onClick(() => {
						component.setValue(DEFAULT_SETTINGS[fieldName])
						component.onChanged()
					})
			})

		const sampleEl = document.createElement('div')
		sampleEl.setAttr('style', 'display: flex; gap: 1em; margin-bottom: .25em;')

		const helpLinkEl = document.createElement('a')
		helpLinkEl.setAttribute('href', 'https://momentjs.com/docs/#/displaying/format/')
		helpLinkEl.innerText = 'Pattern syntax reference'
		helpLinkEl.setAttr('style', 'margin-right: auto;')

		const sampleLabelEl = document.createElement('div')
		sampleLabelEl.setAttr('style', 'opacity: 75%')
		sampleLabelEl.setText("Sample value:")

		sampleEl.appendChild(helpLinkEl)
		sampleEl.appendChild(sampleLabelEl)
		sampleEl.appendChild(sampleValueEl)
		this.containerEl.appendChild(sampleEl)
		return setting
	}
}
