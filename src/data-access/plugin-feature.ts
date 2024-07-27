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

import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from './journal-folder-settings.type'
import type { Plugin, TFile } from 'obsidian'
import { FolderSettingsResolver } from './folder-settings-resolver'

// noinspection JSUnusedLocalSymbols
export abstract class PluginFeature {
  #settingsResolver: FolderSettingsResolver
  #settings = DEFAULT_SETTINGS

  protected constructor(protected plugin: Plugin) {
    this.#settingsResolver = new FolderSettingsResolver(plugin)
  }

  protected get globalSettings(): JournalFolderSettings {
    return this.#settings
  }

  protected getSettings(
    file: TFile | null = null,
    embeddedConfig = ''
  ): JournalFolderSettings {
    return this.#settingsResolver.resolve(this.#settings, file, embeddedConfig)
  }

  async load(): Promise<void> {}

  unload(): void {}

  onExternalSettingsChange(): void {}

  useSettings(settings: JournalFolderSettings): void {
    this.#settings = settings
  }

  getCurrentFile(linkPath: string, sourcePath = ''): TFile | null {
    return this.plugin.app.metadataCache.getFirstLinkpathDest(
      linkPath,
      sourcePath
    )
  }

  expectCurrentFile(linkPath: string, sourcePath = ''): TFile {
    const file: TFile | null = this.getCurrentFile(linkPath, sourcePath)
    if (!file)
      throw Error(
        `Current not found (linkPath: ${sourcePath}, sourcePath: ${sourcePath})`
      )
    return file
  }
}
