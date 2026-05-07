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

import { type App, TFile, TFolder } from 'obsidian'
import { configPathFor, isJournalFolder } from '../../data-access'

// All folders in the vault that *aren't* already journal folders, suitable
// for offering as initialisation targets. The vault root is excluded — the
// plugin's link-resolution behaviour misbehaves there (see top-level
// README) so we never want to invite the user to make it a journal folder.
export function findInitialisableFolders(app: App): TFolder[] {
  const out: TFolder[] = []
  for (const file of app.vault.getAllLoadedFiles()) {
    if (!(file instanceof TFolder)) continue
    if (file.isRoot()) continue
    if (isJournalFolder(app, file.path)) continue
    out.push(file)
  }
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

// Initial body for a freshly-created `journal-folder.md`. Seeds
// `journal-folder-title` with the folder's own name so the header shows a
// sensible label out of the box even without the global
// `useFolderNameAsDefaultTitle` setting being on. The user can edit (or
// delete) the field later via the per-folder configuration editor.
export function buildDefaultJournalFolderConfig(folderName: string): string {
  return `---\njournal-folder-title: ${folderName}\n---\n`
}

// Creates a `journal-folder.md` in the given folder, marking it as a
// journal folder. Returns the new TFile. If a config file already exists
// at the target path (race condition with another caller, or the folder
// was already a journal folder) returns the existing file unchanged.
export async function initialiseJournalFolder(
  app: App,
  folder: TFolder
): Promise<TFile> {
  const path = configPathFor(folder.path)
  const existing = app.vault.getAbstractFileByPath(path)
  if (existing instanceof TFile) return existing
  return app.vault.create(path, buildDefaultJournalFolderConfig(folder.name))
}
