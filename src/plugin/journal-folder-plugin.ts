import { Plugin } from 'obsidian'
import { JournalHeaderFeature } from '../features/journal-header'
import { PluginFeatureSet } from './plugin-feature-set'
import { SettingsManager } from './settings-manager'

export default class JournalFolderPlugin extends Plugin {
	#features: PluginFeatureSet = new PluginFeatureSet()
		.addFeature(new JournalHeaderFeature(this.app))

	#configManager = new SettingsManager({
		loadFromStorage: this.loadData.bind(this),
		saveToStorage: this.saveData.bind(this),
		addSettingTab: this.addSettingTab.bind(this),
		useSettings: this.#features.useSettings,
		addFeature: this.#features.addFeature
	})

	onExternalSettingsChange = this.#configManager.updateSettingsFromStorage

	readonly onload = async () => {
		await this.#configManager.updateSettingsFromStorage()
		await this.#features.load(this)
	}

	readonly onunload = () =>this.#features.unload(this)
}
