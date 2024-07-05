import { Plugin } from 'obsidian'
import { JournalHeaderFeature } from '../features/journal-header'
import { PluginFeatureSet } from './plugin-feature-set'
import { JournalFolderSettingsFeature } from '../features/journal-folder-settings/journal-folder-settings-feature'

export default class JournalFolderPlugin extends Plugin {
	#features: PluginFeatureSet = new PluginFeatureSet()
		.addFeature(new JournalHeaderFeature(this))

	#configManager = new JournalFolderSettingsFeature(this)

	readonly onExternalSettingsChange = this.#configManager.updateSettingsFromStorage
	readonly useSettings = this.#features.useSettings
	readonly addFeature = this.#features.addFeature

	readonly onload = async () => {
		await this.#configManager.updateSettingsFromStorage()
		await this.#features.load()
	}

	readonly onunload = () => this.#features.unload()
}
