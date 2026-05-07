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

import { isJournalFileBasename } from '../../data-access'

// Picks the folder the sidebar should show on first load (or after the
// known-folders list changes). Preference: configured default → first
// known journal folder → empty string (no journal folders exist yet).
// The default is only honoured if it's still in the known list, so a
// renamed/deleted default doesn't leave the picker stuck on a phantom
// path.
export function resolveSelectedFolder(
  defaultFolder: string,
  knownFolders: string[]
): string {
  if (knownFolders.includes(defaultFolder)) return defaultFolder
  return knownFolders[0] ?? ''
}

// Decides whether dynamic mode should switch the sidebar's selected folder
// in response to an active-leaf change, and to which folder. Returns the
// new selection, or `null` to leave the sidebar alone. The rules:
// - non-journal-file basenames are ignored (clicking a regular note
//   shouldn't yank the sidebar away)
// - the file's parent folder must already be a known journal folder
// - already-selected folders are reported as `null` so callers can skip
//   redundant work
export function resolveDynamicSelection(args: {
  activeFilePath: string | null
  activeFileBasename: string | null
  activeFileParentPath: string | null
  knownFolders: string[]
  currentSelection: string
  quartersEnabled: boolean
}): string | null {
  const {
    activeFilePath,
    activeFileBasename,
    activeFileParentPath,
    knownFolders,
    currentSelection,
    quartersEnabled,
  } = args
  if (!activeFilePath || !activeFileBasename || activeFileParentPath === null) {
    return null
  }
  if (!isJournalFileBasename(activeFileBasename, quartersEnabled)) return null
  if (!knownFolders.includes(activeFileParentPath)) return null
  if (activeFileParentPath === currentSelection) return null
  return activeFileParentPath
}
