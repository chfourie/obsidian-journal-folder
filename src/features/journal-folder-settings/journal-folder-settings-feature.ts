import { DEFAULT_SETTINGS, type JournalFolderSettings, PluginFeature } from '../../data-access'
import type JournalFolderPlugin from '../../plugin/journal-folder-plugin'

export class JournalFolderSettingsFeature extends PluginFeature<JournalFolderPlugin> {
	#settings: JournalFolderSettings = DEFAULT_SETTINGS

	constructor(plugin: JournalFolderPlugin) {
		super(plugin)
	}

	readonly updateSettingsFromStorage = async (): Promise<void> => {
		this.#settings = {...this.#settings, ...await this.plugin.loadData()}
		await this.plugin.saveData(this.#settings)
		this.plugin.useSettings({...this.#settings})
	}
}
