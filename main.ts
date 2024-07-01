import { Plugin } from 'obsidian'
import { JournalHeaderFeature, PluginFeatureSet } from './features'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from './data-access/journal-folder-settings'

export default class JournalFolderPlugin extends Plugin {
	#settings: JournalFolderSettings = DEFAULT_SETTINGS

	#features: PluginFeatureSet = new PluginFeatureSet()
		.addFeature(new JournalHeaderFeature())

	get settings(): JournalFolderSettings {
		return this.#settings
	}

	async onload() {
		await this.loadSettings()
		this.#features.load(this)
	}

	onunload() {
		this.#features.unload(this)
	}

	async loadSettings(): Promise<void> {
		this.#settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}
}
