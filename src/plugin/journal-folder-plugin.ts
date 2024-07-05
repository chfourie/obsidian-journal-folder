import { Plugin } from 'obsidian'
import { PluginFeatureSet } from './plugin-feature-set'
import { JournalHeaderFeature } from '../features/journal-header'
import { JournalFolderSettingsFeature } from '../features/journal-folder-settings'

export default class JournalFolderPlugin extends Plugin {
	#features: PluginFeatureSet = new PluginFeatureSet()
		.addFeature(new JournalFolderSettingsFeature(this))
		.addFeature(new JournalHeaderFeature(this))

	readonly onExternalSettingsChange = this.#features.onExternalSettingsChange
	readonly useSettings = this.#features.useSettings
	readonly onload = this.#features.load
	readonly unload = this.#features.unload
}
