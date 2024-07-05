import { App, Plugin, type PluginManifest } from 'obsidian'
import { PluginFeatureSet } from './plugin-feature-set'
import { JournalHeaderFeature } from '../features/journal-header'
import { JournalFolderSettingsFeature } from '../features/journal-folder-settings'

export default class JournalFolderPlugin extends Plugin {
	readonly #features: PluginFeatureSet = new PluginFeatureSet()

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest)

		this.#features
			.addFeature(new JournalFolderSettingsFeature(this, this.#features.useSettings))
			.addFeature(new JournalHeaderFeature(this))
	}

	readonly onExternalSettingsChange = this.#features.onExternalSettingsChange
	readonly onload = this.#features.load
	readonly unload = this.#features.unload
}
