import type { PluginFeature } from '@journal-folder/data-access'
import type { JournalFolderPlugin } from './journal-folder-plugin'

export class PluginFeatureSet {
	readonly #pluginFeatures: PluginFeature[] = []

	addFeature(feature: PluginFeature): PluginFeatureSet {
		this.#pluginFeatures.push(feature)
		return this
	}

	load(plugin: JournalFolderPlugin): void {
		this.#pluginFeatures.forEach(feature => {
			try {
				feature.load(plugin)
			} catch (e) {
				console.error(e)
			}
		})
	}

	unload(plugin: JournalFolderPlugin): void {
		this.#pluginFeatures.forEach(feature => {
			try {
				feature.unload(plugin)
			} catch (e) {
				console.error(e)
			}
		})
	}
}