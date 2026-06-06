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
  firstNonEmptyTemplate,
  type JournalFolderSettings,
  type JournalTimeUnit,
  journalUnitForBasename,
  PluginFeature,
  templateCandidatePaths,
} from 'src/data-access'
import { Notice, TFile, type Plugin, type TAbstractFile } from 'obsidian'
import {
  DEFAULT_AUTO_TEMPLATE,
  isTruthySetting,
  stripFrontMatter,
} from './auto-template-content'
import { runInlineTemplateMigration } from './migrate-inline-templates'

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
          this.handleCreate(file)
        })
      )
      // One-time move of legacy inline template text → template notes.
      // noinspection JSIgnoredPromiseFromCall
      this.maybeMigrateInlineTemplates()
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
      await this.saveSettings({ ...settings, templatesMigratedToFiles: true })
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

    const template = await this.resolveTemplate(
      file,
      unit,
      settings,
      folderConfigFile
    )
    await this.plugin.app.vault.modify(file, template)
  }

  // Resolution precedence (first non-empty wins):
  //   1. `<folder>/<override>/<tier>.md`   per-journal override
  //   2. `<folder>/<override>/default.md`
  //   3. body of `journal-folder.md`       legacy per-folder template
  //   4. `<templateFolder>/<tier>.md`      global
  //   5. `<templateFolder>/default.md`
  //   6. built-in DEFAULT_AUTO_TEMPLATE
  // Template *files* are copied verbatim (front matter included); only the
  // legacy config-note body is front-matter-stripped.
  private async resolveTemplate(
    file: TFile,
    unit: JournalTimeUnit,
    settings: JournalFolderSettings,
    folderConfigFile: TFile
  ): Promise<string> {
    const { override, global } = templateCandidatePaths({
      journalFolderPath: file.parent?.path ?? '',
      overrideName: settings.templateOverrideFolderName,
      globalTemplateFolder: settings.templateFolder,
      tier: unit,
    })
    const overrideContents = await Promise.all(
      override.map((p) => this.readFileIfExists(p))
    )
    const body = stripFrontMatter(
      await this.plugin.app.vault.read(folderConfigFile)
    )
    const globalContents = await Promise.all(
      global.map((p) => this.readFileIfExists(p))
    )
    return firstNonEmptyTemplate(
      [...overrideContents, body, ...globalContents],
      DEFAULT_AUTO_TEMPLATE
    )
  }

  private async readFileIfExists(path: string): Promise<string | null> {
    const f = this.plugin.app.vault.getAbstractFileByPath(path)
    return f instanceof TFile ? this.plugin.app.vault.read(f) : null
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
