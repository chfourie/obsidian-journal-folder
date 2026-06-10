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
  type JournalFolderSettings,
  journalUnitForBasename,
  PluginFeature,
} from 'src/data-access'
import { Notice, TFile, type Plugin, type TAbstractFile } from 'obsidian'
import { isTruthySetting } from './auto-template-content'
import { runInlineTemplateMigration } from './migrate-inline-templates'
import { resolveNoteTemplate } from './template-resolution'

export class JournalAutoTemplateFeature extends PluginFeature {
  constructor(
    plugin: Plugin,
    private saveSettings: (settings: JournalFolderSettings) => Promise<void>
  ) {
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
          void this.handleCreate(file)
        })
      )
      // One-time move of legacy inline template text → template notes.
      // noinspection JSIgnoredPromiseFromCall
      void this.maybeMigrateInlineTemplates()
    })
  }

  // Idempotent: runs once, then sets `templatesMigratedToFiles` so it never
  // repeats. The template notes it writes aren't journal basenames and live
  // outside any journal folder, so the `create` events they fire are no-ops
  // for `handleCreate`.
  private async maybeMigrateInlineTemplates(): Promise<void> {
    const settings = this.globalSettings
    if (settings.templatesMigratedToFiles) return
    try {
      const written = await runInlineTemplateMigration(
        this.plugin.app,
        settings
      )
      // Re-read the live settings at save time — the known stale-snapshot
      // trap: a settings change landing while the migration's vault writes
      // are in flight would be silently overwritten by saving the
      // pre-await `settings` snapshot (which remains the right *input*
      // for the migration itself).
      await this.saveSettings({
        ...this.globalSettings,
        templatesMigratedToFiles: true,
      })
      if (written > 0) {
        new Notice(
          `Journal Folder: moved ${written} template${
            written === 1 ? '' : 's'
          } into ${settings.templateFolder}`
        )
      }
    } catch (error) {
      // Leave the flag unset so a later load retries rather than silently
      // losing the legacy templates.
      console.error('journal-folder: template migration failed', error)
    }
  }

  private async handleCreate(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile)) return
    if (file.extension !== 'md') return
    if (file.name === FOLDER_CONFIG_FILENAME) return

    const settings = this.getSettings(file)
    const unit = journalUnitForBasename(
      file.basename,
      isTruthySetting(settings.quartersEnabled)
    )
    if (unit === null) return

    const folderConfigFile = this.getFolderConfigFile(file)
    if (!folderConfigFile) return

    if (!isTruthySetting(settings.autoTemplateEnabled)) return

    // Don't overwrite content the user (or another plugin) has already
    // placed in the file. The `create` event fires before most editors
    // render, so an empty file is the common case.
    const existing = await this.plugin.app.vault.read(file)
    if (existing.length > 0) return

    const template = await resolveNoteTemplate(this.plugin.app, file, settings)
    if (template === null) return
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
