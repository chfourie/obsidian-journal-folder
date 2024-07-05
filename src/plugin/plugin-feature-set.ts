/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { JournalFolderSettings, PluginFeature } from '../data-access'

export class PluginFeatureSet {
	readonly #pluginFeatures: PluginFeature[] = []

	readonly addFeature = (feature: PluginFeature): PluginFeatureSet => {
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
				feature.useSettings({ ...settings })
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
