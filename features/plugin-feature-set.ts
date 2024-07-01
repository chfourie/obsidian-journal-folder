import type { PluginFeature } from './plugin-feature'
import type JournalFolderPlugin from '../main'

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
