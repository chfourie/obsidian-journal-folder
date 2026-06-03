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

import type { JournalTask } from '../../data-access'

// Sorts ascending by source-note range length so daily tasks always come
// before weekly ones, then weekly before monthly, etc. Tie-breaks on
// `folderPath` then `sourceLine` to keep ordering stable across runs.
export function sortTasks(tasks: JournalTask[]): JournalTask[] {
  return [...tasks].sort((a, b) => {
    if (a.noteRangeDays !== b.noteRangeDays) {
      return a.noteRangeDays - b.noteRangeDays
    }
    const folderCmp = a.folderPath.localeCompare(b.folderPath)
    if (folderCmp !== 0) return folderCmp
    return a.sourceLine - b.sourceLine
  })
}
