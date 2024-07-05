import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../data-access'
import type JournalFolderPlugin from './journal-folder-plugin'

export class SettingsManager {
	#settings: JournalFolderSettings = DEFAULT_SETTINGS
	#plugin: JournalFolderPlugin

	constructor(plugin: JournalFolderPlugin) {
		this.#plugin = plugin
	}

	readonly updateSettingsFromStorage = async (): Promise<void> => {
		this.#settings = {...this.#settings, ...await this.#plugin.loadData()}
		await this.#plugin.saveData(this.#settings)
		this.#plugin.useSettings({...this.#settings})
	}
}
