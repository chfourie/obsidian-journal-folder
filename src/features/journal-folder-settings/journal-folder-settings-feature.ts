import { DEFAULT_SETTINGS, type JournalFolderSettings, PluginFeature } from '../../data-access'
import type { Plugin } from 'obsidian'

export class JournalFolderSettingsFeature extends PluginFeature {

	constructor(plugin: Plugin, private propagateSettings: (settings: JournalFolderSettings) => void) {
		super(plugin)
		this.useSettings(DEFAULT_SETTINGS)
	}

	async load(): Promise<void> {
		await this.updateSettingsFromStorage()
	}

	private readonly saveSettings = async (settings: JournalFolderSettings): Promise<void> => {
		await this.plugin.saveData(settings)
		this.propagateSettings(settings)
	}

	readonly updateSettingsFromStorage = async (): Promise<void> => {
		const settings = {...this.settings, ...await this.plugin.loadData()}
		await this.saveSettings(settings)
	}

	readonly onExternalSettingsChange = this.updateSettingsFromStorage
}
