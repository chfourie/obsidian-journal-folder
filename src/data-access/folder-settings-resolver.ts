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

import { type FrontMatterCache, type Plugin, type TFile } from 'obsidian'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from './journal-folder-settings.type'
import { camelCase } from './string-utils'

export class FolderSettingsResolver {

	constructor(private plugin: Plugin) {
	}

	resolve(globalSettings:JournalFolderSettings, file: TFile | null = null, embeddedConfig = ''): JournalFolderSettings {
		return { ...globalSettings, ...this.getFolderConfig(file), ...this.getEmbeddedConfig(embeddedConfig) }
	}

	private getFolderConfig(file: TFile | null): Partial<JournalFolderSettings> {
		const config = {}
		const frontMatter = this.getFrontMatterCache(this.getFolderConfigFile(file))

		Object.keys(frontMatter).forEach(key => {
			const configKey = camelCase(key)
			if (Object.keys(DEFAULT_SETTINGS).some(key => key === configKey)) {
				// @ts-ignore
				config[configKey] = frontMatter[key]
			}
		})

		return config
	}

	private getFolderConfigFile(file: TFile | null) {
		if (!file) return null
		const linkPath = `${file.parent?.path}/journal-folder.md`
		return this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, '')
	}

	private getEmbeddedConfig(rawConfig: string): Partial<JournalFolderSettings> {
		if (!rawConfig.trim()) return {}
		return {}
	}

	private getFrontMatterCache(file: TFile | null): FrontMatterCache {
		const frontMatter = (file && this.plugin.app.metadataCache.getFileCache(file)?.frontmatter)
		return frontMatter || {}
	}
}
