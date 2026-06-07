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

import { type App, TFile } from 'obsidian'
import {
  configPathFor,
  firstNonEmptyTemplate,
  type JournalFolderSettings,
  journalUnitForBasename,
  templateCandidatePaths,
} from '../../data-access'
import {
  DEFAULT_AUTO_TEMPLATE,
  isTruthySetting,
  stripFrontMatter,
} from './auto-template-content'

// True when `file` is a journal note living in a folder with a
// `journal-folder.md` config note — i.e. a note auto-template would seed. The
// caller passes the *resolved* (per-folder) settings so `quartersEnabled` is
// honoured.
export function isTemplateableNote(
  app: App,
  file: TFile,
  settings: JournalFolderSettings
): boolean {
  if (
    journalUnitForBasename(
      file.basename,
      isTruthySetting(settings.quartersEnabled)
    ) === null
  ) {
    return false
  }
  if (!file.parent) return false
  const config = app.vault.getAbstractFileByPath(configPathFor(file.parent.path))
  return config instanceof TFile
}

// Resolves the template body that would seed `file`, following the documented
// precedence (override files → legacy `journal-folder.md` body → global files →
// built-in default). Returns null when `file` isn't a templateable journal
// note. Shared by the auto-template create listener and the sidebar's
// *Re-populate from template* action so both resolve identically.
//
// `settings` must be the per-folder-resolved settings for `file`.
export async function resolveNoteTemplate(
  app: App,
  file: TFile,
  settings: JournalFolderSettings
): Promise<string | null> {
  const unit = journalUnitForBasename(
    file.basename,
    isTruthySetting(settings.quartersEnabled)
  )
  if (unit === null || !file.parent) return null
  const config = app.vault.getAbstractFileByPath(configPathFor(file.parent.path))
  if (!(config instanceof TFile)) return null

  const { override, globalPaths } = templateCandidatePaths({
    journalFolderPath: file.parent.path,
    overrideName: settings.templateOverrideFolderName,
    globalTemplateFolder: settings.templateFolder,
    tier: unit,
  })
  const readIfExists = async (path: string): Promise<string | null> => {
    const f = app.vault.getAbstractFileByPath(path)
    return f instanceof TFile ? app.vault.read(f) : null
  }
  // Template *files* are copied verbatim (front matter included); only the
  // legacy config-note body is front-matter-stripped.
  const overrideContents = await Promise.all(override.map(readIfExists))
  const body = stripFrontMatter(await app.vault.read(config))
  const globalContents = await Promise.all(globalPaths.map(readIfExists))
  return firstNonEmptyTemplate(
    [...overrideContents, body, ...globalContents],
    DEFAULT_AUTO_TEMPLATE
  )
}
