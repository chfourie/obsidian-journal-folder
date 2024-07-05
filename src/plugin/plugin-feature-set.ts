import type { JournalFolderSettings, PluginFeature } from '../data-access'
import type JournalFolderPlugin from './journal-folder-plugin'

export class PluginFeatureSet {
	readonly #pluginFeatures: PluginFeature[] = []

	readonly addFeature = (feature: PluginFeature): PluginFeatureSet => {
		this.#pluginFeatures.push(feature)
		return this
	}

	readonly load = async (plugin: JournalFolderPlugin): Promise<void> => {
		for (const feature of this.#pluginFeatures) {
			try {
				await feature.load(plugin)
			} catch (e) {
				console.error(e)
			}
		}
	}

	readonly unload = (plugin: JournalFolderPlugin): void => {
		this.#pluginFeatures.forEach(feature => {
			try {
				feature.unload(plugin)
			} catch (e) {
				console.error(e)
			}
		})
	}

	readonly useSettings = (settings: JournalFolderSettings): void => {
		this.#pluginFeatures.forEach(feature => {
			try {
				feature.useSettings({...settings})
			} catch (e) {
				console.error(e)
			}
		})
	}
}