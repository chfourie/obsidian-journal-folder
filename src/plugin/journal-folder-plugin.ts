import { Plugin } from 'obsidian'
import { JournalHeaderFeature } from '../features/journal-header'
import { PluginFeatureSet } from './plugin-feature-set'
import { SettingsManager } from './settings-manager'

export default class JournalFolderPlugin extends Plugin {
	#features: PluginFeatureSet = new PluginFeatureSet()
		.addFeature(new JournalHeaderFeature(this.app))

	#configManager = new SettingsManager(this)

	readonly onExternalSettingsChange = this.#configManager.updateSettingsFromStorage
	readonly useSettings = this.#features.useSettings
	readonly addFeature = this.#features.addFeature

	readonly onload = async () => {
		await this.#configManager.updateSettingsFromStorage()
		await this.#features.load(this)
	}

	readonly onunload = () =>this.#features.unload(this)
}
