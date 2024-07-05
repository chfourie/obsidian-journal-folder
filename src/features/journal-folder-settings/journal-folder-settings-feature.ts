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


	onExternalSettingsChange() {
		// noinspection JSIgnoredPromiseFromCall
		this.updateSettingsFromStorage()
	}

	readonly updateSettingsFromStorage = async (): Promise<void> => {
		const settings = {...this.settings, ...await this.plugin.loadData()}
		await this.plugin.saveData(settings)
		this.propagateSettings(settings)
	}
}
