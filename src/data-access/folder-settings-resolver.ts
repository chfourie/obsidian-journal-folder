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

import { TFile, type FrontMatterCache, type Plugin } from 'obsidian'
import { type JournalFolderSettings } from './journal-folder-settings.type'
import { camelCase } from './string-utils'

export class FolderSettingsResolver {
  constructor(private plugin: Plugin) {}

  resolve(
    globalSettings: JournalFolderSettings,
    file: TFile | null = null,
    embeddedConfig = ''
  ): JournalFolderSettings {
    return {
      ...globalSettings,
      ...this.getFolderConfig(file),
      ...this.getEmbeddedConfig(embeddedConfig),
    }
  }

  private getFolderConfig(file: TFile | null): Partial<JournalFolderSettings> {
    const config = {}
    const frontMatter = this.getFrontMatterCache(this.getFolderConfigFile(file))

    Object.keys(frontMatter).forEach((key) => {
      const configKey = camelCase(key)
      // @ts-ignore
      config[configKey] = frontMatter[key]
    })

    return config
  }

  private getFolderConfigFile(file: TFile | null) {
    if (!file) return null
    const dest = this.plugin.app.vault.getAbstractFileByPath(
      `${file.parent?.path}/journal-folder.md`
    )
    return dest instanceof TFile ? dest : null
  }

  private getEmbeddedConfig(rawConfig: string): Partial<JournalFolderSettings> {
    const config = {}
    rawConfig = rawConfig.trim()
    if (!rawConfig) return {}

    rawConfig
      .split('\n')
      .map((line) => this.keyValuePair(line))
      .filter((item) => !!item)
      .forEach((item) => {
        // @ts-ignore
        config[item.key] = item.value
      })

    return config
  }

  private getFrontMatterCache(file: TFile | null): FrontMatterCache {
    const frontMatter =
      file && this.plugin.app.metadataCache.getFileCache(file)?.frontmatter
    return frontMatter || {}
  }

  private keyValuePair(
    line: string
  ): { key: string; value: string } | undefined {
    line = line.trim()
    const separatorIndex = line.indexOf(':')

    if (separatorIndex > 0) {
      const key = camelCase(line.substring(0, separatorIndex).trim())
      const value = line.substring(separatorIndex + 1).trim()
      return { key, value }
    }
  }
}
