import { Plugin } from 'obsidian'
import { JournalHeaderFeature } from '../features/journal-header'
import { PluginFeatureSet } from './plugin-feature-set'
import { SettingsManager } from '../features/journal-folder-settings'

export default class JournalFolderPlugin extends Plugin {
	#features: PluginFeatureSet = new PluginFeatureSet()
		.addFeature(new JournalHeaderFeature())

	#configManager = new SettingsManager({
		loadFromStorage: this.loadData,
		saveToStorage: this.saveData,
		useSettings: this.#features.useSettings
	})

	onExternalSettingsChange = this.#configManager.onExternalSettingsChange

	async onload() {
		await this.#configManager.loadSettings()
		await this.#features.load(this)
	}

	onunload() {
		this.#features.unload(this)
	}
}
