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
  type App,
  type FrontMatterCache,
  Modal,
  TFile,
} from 'obsidian'
import {
  configPathFor,
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../data-access'
import { renderSettingsForm } from '../journal-folder-settings/journal-folder-settings-tab'
import { computeFrontMatterDiff } from './folder-config-sync'
import { camelCase } from '../../data-access/string-utils'

// Modal that edits the per-folder configuration stored in
// `<folder>/journal-folder.md`'s YAML front matter. Reuses the plugin
// settings tab's form renderer (in `'folder'` mode, which suppresses
// global-only fields and the destructive Reset section). Saves diff the
// new values against the supplied `getGlobalSettings` to keep the front
// matter sparse — fields matching the global config are *removed* from
// front matter so future global edits flow through.
export class FolderConfigModal extends Modal {
  constructor(
    app: App,
    private readonly folderPath: string,
    private readonly getGlobalSettings: () => JournalFolderSettings
  ) {
    super(app)
  }

  onOpen(): void {
    const file = this.getConfigFile()
    if (!file) {
      // The button that opens this modal is gated on a journal folder
      // being selected, but the file could vanish between click and
      // open (rename, external delete). Render a fallback rather than
      // crash.
      this.titleEl.setText('Folder configuration')
      this.contentEl.createEl('p', {
        text:
          "Couldn't find the journal-folder.md for this folder. " +
          'It may have been renamed or deleted.',
      })
      return
    }

    this.titleEl.setText(
      `Edit configuration — ${this.folderPath || '(vault root)'}`
    )
    this.contentEl.addClass('journal-folder-config-modal')

    renderSettingsForm({
      app: this.app,
      containerEl: this.contentEl,
      mode: 'folder',
      getCurrentSettings: () => this.readEffectiveSettings(file),
      saveSettings: (settings) => this.saveToFrontMatter(file, settings),
    })
  }

  onClose(): void {
    this.contentEl.empty()
  }

  private getConfigFile(): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(
      configPathFor(this.folderPath)
    )
    return file instanceof TFile ? file : null
  }

  // Effective settings = global defaults overlaid with whatever the
  // folder's front matter has explicitly set. Mirrors what
  // `FolderSettingsResolver.getFolderConfig` does, but staying close to
  // it (rather than calling into it) keeps the renderer decoupled from
  // the resolver's TFile-based contract.
  private readEffectiveSettings(file: TFile): JournalFolderSettings {
    const global = this.getGlobalSettings()
    const fm: FrontMatterCache =
      this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}
    const overrides: Partial<JournalFolderSettings> = {}
    for (const key of Object.keys(fm)) {
      const camel = camelCase(key) as keyof JournalFolderSettings
      // Only carry through fields that the settings type knows about —
      // arbitrary front-matter keys (the user's own metadata) shouldn't
      // bleed into the form.
      if (camel in DEFAULT_SETTINGS) {
        // Heterogeneous value types are intentional — front-matter
        // values can be strings, booleans, etc., and the rest of the
        // plugin already handles the runtime coercion.
        ;(overrides as Record<string, unknown>)[camel] = fm[key]
      }
    }
    return { ...global, ...overrides }
  }

  private saveToFrontMatter(
    file: TFile,
    newSettings: JournalFolderSettings
  ): Promise<void> {
    const diff = computeFrontMatterDiff(newSettings, this.getGlobalSettings())
    return this.app.fileManager.processFrontMatter(file, (fm) => {
      for (const key of diff.remove) {
        delete fm[key]
      }
      for (const [key, value] of Object.entries(diff.set)) {
        fm[key] = value
      }
    })
  }
}
