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
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from './journal-folder-settings.type'
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
  'todayButtonPlacement',
  'templateFolder',
  'templateOverrideFolderName',
  'templatesMigratedToFiles',
  'tasksSidebarEnabled',
  'tasksSidebarAnchor',
  'tasksSidebarRange',
  'tasksSidebarFolderMode',
  'tasksSidebarFolder',
  'tasksShowCompleted',
  'tasksOnlySidebarAnchor',
  'tasksOnlySidebarRange',
  'tasksOnlySidebarFolderMode',
  'tasksOnlySidebarFolder',
  'tasksOnlySidebarShowCompleted',
  'tasksMaxItems',
  'taskFlows',
  'defaultTaskFlow',
  'taskInteractionScope',
  'taskClickOpensPicker',
  'signifiers',
  'signifierHideTagInReadingView',
  'signifierHideTagInLivePreview',
  'signifierShowTagsOnActiveLine',
  'signifierPlacement',
  'signifierReserveGutter',
  'taskCategories',
  'taskCategoryShowUnderNote',
])

// Embedded `key: value` config lines arrive as raw strings. Coerce each
// value to the field's primitive type — derived from the field's
// `DEFAULT_SETTINGS` value — so a numeric field never lands in the typed
// settings as a string (`tasks > '200'`-style comparisons silently
// misbehave) and booleans follow the front-matter convention (only the
// literal "false" is falsy on the string path, mirroring
// `isTruthySetting`). Returns `undefined` when the value can't represent
// the field's type (blank / non-numeric text for a number field) — the
// caller skips the entry so the lower layers' value stays in effect.
// Unknown keys and string fields pass through verbatim; non-scalar fields
// are all global-only and filtered out before coercion.
export function coerceEmbeddedSettingValue(
  key: string,
  value: string
): string | number | boolean | undefined {
  const defaultValue = DEFAULT_SETTINGS[key as keyof JournalFolderSettings]
  if (typeof defaultValue === 'number') {
    const parsed = Number(value)
    // `Number('')` is 0 — treat a blank value like garbage, not zero.
    return value === '' || Number.isNaN(parsed) ? undefined : parsed
  }
  if (typeof defaultValue === 'boolean') {
    return value.trim().toLowerCase() !== 'false'
  }
  return value
}

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
    const config: Record<string, unknown> = {}
    const frontMatter = this.getFrontMatterCache(this.getFolderConfigFile(file))

    Object.keys(frontMatter).forEach((key) => {
      const configKey = camelCase(key) as keyof JournalFolderSettings
      if (GLOBAL_ONLY_FIELDS.has(configKey)) return
      // Front-matter values are untyped (`FrontMatterCache` is `any`-indexed);
      // they're carried through as-is and consumed by callers that know the
      // expected per-field shape.
      config[configKey] = frontMatter[key] as unknown
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
    // Assembled untyped (like the front-matter path above) and consumed as
    // a partial overlay; per-field typing is enforced by the coercion.
    const config: Record<string, unknown> = {}
    rawConfig = rawConfig.trim()
    if (!rawConfig) return {}

    rawConfig
      .split('\n')
      .map((line) => this.keyValuePair(line))
      .filter((item) => !!item)
      .forEach((item) => {
        if (GLOBAL_ONLY_FIELDS.has(item.key as keyof JournalFolderSettings))
          return
        const value = coerceEmbeddedSettingValue(item.key, item.value)
        if (value === undefined) return
        config[item.key] = value
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
