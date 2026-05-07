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
  configPathFor,
  FOLDER_CONFIG_FILENAME,
  isJournalFileBasename,
  type JournalFolderSettings,
  PluginFeature,
} from 'src/data-access'
import { TFile, type Plugin, type TAbstractFile } from 'obsidian'
import { isTruthySetting, resolveAutoTemplate } from './auto-template-content'

export class JournalAutoTemplateFeature extends PluginFeature {
  constructor(plugin: Plugin) {
    super(plugin)
  }

  async load(): Promise<void> {
    // The vault fires `create` for every existing file during initial
    // indexing — registering after layout-ready avoids stomping content on
    // startup.
    this.plugin.app.workspace.onLayoutReady(() => {
      this.plugin.registerEvent(
        this.plugin.app.vault.on('create', (file) => {
          // noinspection JSIgnoredPromiseFromCall
          this.handleCreate(file)
        })
      )
    })
  }

  private async handleCreate(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile)) return
    if (file.extension !== 'md') return
    if (file.name === FOLDER_CONFIG_FILENAME) return

    const settings = this.getSettings(file)
    if (
      !isJournalFileBasename(
        file.basename,
        isTruthySetting(settings.quartersEnabled)
      )
    ) {
      return
    }

    const folderConfigFile = this.getFolderConfigFile(file)
    if (!folderConfigFile) return

    if (!isTruthySetting(settings.autoTemplateEnabled)) return

    // Don't overwrite content the user (or another plugin) has already
    // placed in the file. The `create` event fires before most editors
    // render, so an empty file is the common case.
    const existing = await this.plugin.app.vault.read(file)
    if (existing.length > 0) return

    const folderBody = await this.plugin.app.vault.read(folderConfigFile)
    const template = resolveAutoTemplate(folderBody, settings.autoTemplateContent)
    await this.plugin.app.vault.modify(file, template)
  }

  private getFolderConfigFile(file: TFile): TFile | null {
    if (!file.parent) return null
    const config = this.plugin.app.vault.getAbstractFileByPath(
      configPathFor(file.parent.path)
    )
    return config instanceof TFile ? config : null
  }
}

// Re-export the field type so the settings tab can reference it.
export type { JournalFolderSettings }
