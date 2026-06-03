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

// Settings that only make sense at the global level. The per-field JSDoc on
// `JournalFolderSettings` explains why each one is global-only (locale
// singletons, sidebar/file-explorer UI preferences). The resolver strips
// these from folder front-matter and embedded configs so a stray override
// can't silently change process-wide behaviour.
const GLOBAL_ONLY_FIELDS: ReadonlySet<keyof JournalFolderSettings> = new Set([
  'startOfWeek',
  'defaultJournalFolder',
  'hideJournalFolderNotes',
  'sidebarMode',
  'tasksSidebarEnabled',
  'tasksSidebarReference',
  'tasksSidebarFolders',
  'tasksShowCompleted',
  'tasksMaxItems',
  'taskModel',
  'taskCheckboxStyle',
  'documentTasksEnabled',
  'taskCheckboxRendering',
])

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
      const configKey = camelCase(key) as keyof JournalFolderSettings
      if (GLOBAL_ONLY_FIELDS.has(configKey)) return
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
        if (GLOBAL_ONLY_FIELDS.has(item.key as keyof JournalFolderSettings))
          return
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
