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

// A folder counts as a *journal folder* when it contains a markdown note
// with this exact name. The presence of the file is the marker; its body
// (and front matter) hold the per-folder configuration consumed elsewhere.
export const FOLDER_CONFIG_FILENAME = 'journal-folder.md'

// Returns the parent paths of every `journal-folder.md` in the vault, sorted
// alphabetically. The vault root is reported as `'/'` so callers can render
// it in a dropdown without having to special-case the empty string. Note
// that the root is *not* a supported journal folder elsewhere in the plugin
// (Obsidian's link resolution misbehaves there) — this helper just reports
// what's on disk; gating happens in the UI.
export function findJournalFolderPaths(app: App): string[] {
  const paths = new Set<string>()
  for (const file of app.vault.getMarkdownFiles()) {
    if (file.name === FOLDER_CONFIG_FILENAME) {
      paths.add(file.parent?.path ?? '/')
    }
  }
  return [...paths].sort((a, b) => a.localeCompare(b))
}

// True when the given folder path contains a `journal-folder.md`. The path
// must be the folder path itself (e.g. `"Journals/Work"`), not the path of
// the config note. Empty string maps to the vault root.
export function isJournalFolder(app: App, folderPath: string): boolean {
  const path = configPathFor(folderPath)
  const file = app.vault.getAbstractFileByPath(path)
  return file instanceof TFile
}

// Resolves the absolute vault path of the `journal-folder.md` for the given
// folder path. Exported so the sidebar feature and auto-template feature
// can share one definition of where the config file lives.
export function configPathFor(folderPath: string): string {
  if (folderPath === '' || folderPath === '/') return FOLDER_CONFIG_FILENAME
  return `${folderPath}/${FOLDER_CONFIG_FILENAME}`
}
