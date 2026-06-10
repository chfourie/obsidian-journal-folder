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
  FOLDER_CONFIG_FILENAME,
  journalUnitForBasename,
  type TasksSidebarAnchor,
  type TasksSidebarFolderMode,
} from '../../data-access'

// Trailing-debounce window the sidebar views use to coalesce a burst of
// vault events (a sync importing many files, a multi-file edit) into one
// refresh. Short enough to feel immediate, long enough to absorb the
// rename→modify pairs and autosave bursts Obsidian emits.
export const TASK_REFRESH_DEBOUNCE_MS = 200

// What a vault-event scope check needs to know about a task panel. Each
// sidebar surface builds one of these per event from its own settings
// fields; `isJournalFolder` is injected so the predicate stays pure.
export interface TaskEventScope {
  folderMode: TasksSidebarFolderMode
  // The folder scanned when `folderMode` is `'specific'`.
  folder: string
  // The active journal note's parent-folder path, or `null` when the
  // active leaf isn't a recognised journal note.
  activeNoteFolder: string | null
  quartersEnabled: boolean
  isJournalFolder: (folderPath: string) => boolean
}

// Parent folder of a vault path; the root is reported as '/'.
export function parentPathOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '/'
}

// The vault root appears as both `''` and `'/'` depending on the source
// (`TFolder.path` is `'/'`; settings fields may carry `''`).
export function sameFolderPath(a: string, b: string): boolean {
  return (a === '' ? '/' : a) === (b === '' ? '/' : b)
}

// True when a vault event on `path` can change a task panel computed under
// `scope`. Mirrors `resolveTaskFolders`' mode rules per file, so the views
// can drop irrelevant events before paying for a snapshot rebuild: only
// markdown files with a journal basename can carry panel tasks, and only
// when they live directly in a folder the panel scans. The one exception
// is `journal-folder.md` — its presence defines the journal-folder
// topology (the all-folders fallback's folder set), so config-note events
// are always treated as relevant.
export function taskEventAffectsScope(
  path: string,
  scope: TaskEventScope
): boolean {
  const name = path.split('/').pop() ?? path
  if (!name.endsWith('.md')) return false
  if (name === FOLDER_CONFIG_FILENAME) return true
  const basename = name.slice(0, -'.md'.length)
  if (!journalUnitForBasename(basename, scope.quartersEnabled)) return false
  const parent = parentPathOf(path)
  if (scope.folderMode === 'specific' && scope.folder) {
    return sameFolderPath(parent, scope.folder)
  }
  if (scope.folderMode === 'note' && scope.activeNoteFolder !== null) {
    return sameFolderPath(parent, scope.activeNoteFolder)
  }
  // `'all'`, plus the note/specific fallbacks: any journal folder.
  return scope.isJournalFolder(parent)
}

// True when an active-leaf change can alter a task panel computed under
// this scope — only the `'note'` anchor and the `'note'` folder mode read
// the active leaf; every other combination is leaf-independent.
export function activeLeafAffectsTaskScope(scope: {
  anchor: TasksSidebarAnchor
  folderMode: TasksSidebarFolderMode
}): boolean {
  return scope.anchor === 'note' || scope.folderMode === 'note'
}
