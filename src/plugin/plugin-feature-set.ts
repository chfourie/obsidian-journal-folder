import type { JournalFolderSettings, PluginFeature } from '../data-access'
import type { Plugin } from 'obsidian'

export class PluginFeatureSet {
	readonly #pluginFeatures: PluginFeature<Plugin>[] = []

	readonly addFeature = (feature: PluginFeature<Plugin>): PluginFeatureSet => {
		this.#pluginFeatures.push(feature)
		return this
	}

	readonly load = async (): Promise<void> => {
		for (const feature of this.#pluginFeatures) {
			try {
				await feature.load()
			} catch (e) {
				console.error(e)
			}
		}
	}

	readonly unload = (): void => {
		this.#pluginFeatures.forEach(feature => {
			try {
				feature.unload()
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

	readonly onExternalSettingsChange = (): void => {
		this.#pluginFeatures.forEach(feature => {
			try {
				feature.onExternalSettingsChange()
			} catch (e) {
				console.error(e)
			}
		})
	}
}
