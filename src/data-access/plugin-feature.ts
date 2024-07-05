/*
Utilities for folder-based journaling in Obsidian
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

import type { JournalFolderSettings } from './journal-folder-settings.type'
import type { Plugin, TFile } from 'obsidian'

// noinspection JSUnusedLocalSymbols
export abstract class PluginFeature {
	#settings: JournalFolderSettings | undefined

	protected constructor(protected plugin: Plugin) {
	}

	// noinspection JSUnusedGlobalSymbols
	protected get settings() {
		if (!this.#settings) throw new Error('Settings must be set')
		return this.#settings
	}

	async load(): Promise<void> {
	}

	unload(): void {
	}

	onExternalSettingsChange(): void {
	}

	useSettings(settings: JournalFolderSettings): void {
		this.#settings = settings
	}

	getCurrentFile(linkPath: string, sourcePath = ''): TFile | null {
		return this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)
	}

	expectCurrentFile(linkPath: string, sourcePath = ''): TFile {
		const file: TFile | null = this.getCurrentFile(linkPath, sourcePath)
		if (!file) throw Error(`Current not found (linkPath: ${sourcePath}, sourcePath: ${sourcePath})`)
		return file
	}
}
