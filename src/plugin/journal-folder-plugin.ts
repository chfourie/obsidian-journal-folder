import { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../data-access'
import { JournalHeaderFeature } from '../features/journal-header'
import { PluginFeatureSet } from './plugin-feature-set'
import { JournalFolderSettingsTab } from './journal-folder-settings-tab'

export default class JournalFolderPlugin extends Plugin {
	#settings: JournalFolderSettings = DEFAULT_SETTINGS

	#features: PluginFeatureSet = new PluginFeatureSet()
		.addFeature(new JournalHeaderFeature())

	get settings(): JournalFolderSettings {
		return this.#settings
	}

	async onload() {
		await this.loadSettings()
		this.addSettingTab(new JournalFolderSettingsTab(this))
		this.#features.load(this)
	}

	onunload() {
		this.#features.unload(this)
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.#settings)
	}

	async loadSettings(): Promise<void> {
		this.#settings = {...DEFAULT_SETTINGS, ...await this.loadData()}
	}
}
