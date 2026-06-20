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

import { type JournalFolderSettings, kebabCase } from '../../data-access'

// The fields a user can override per-folder. The remaining members of
// `JournalFolderSettings` (`startOfWeek`, `defaultJournalFolder`,
// `hideJournalFolderNotes`, `sidebarMode`, and every `tasks*` /
// `task*` field) are global-only — see the JSDoc on each field in
// `journal-folder-settings.type.ts`. The two exceptions are
// `taskMigrationPlacement` / `taskMigrationHeading`: migration
// placement is a per-note *layout* concern (where copied lines land
// in this folder's notes), not a process-wide model/UI preference, so
// it is deliberately folder-honored.
export const PER_FOLDER_FIELDS = [
  'dailyNoteTitlePattern',
  'dailyNoteShortTitlePattern',
  'dailyNoteMediumTitlePattern',
  'weeklyNoteTitlePattern',
  'weeklyNoteShortTitlePattern',
  'weeklyNoteMediumTitlePattern',
  'monthlyNoteTitlePattern',
  'monthlyNoteShortTitlePattern',
  'monthlyNoteMediumTitlePattern',
  'quarterlyNoteTitlePattern',
  'quarterlyNoteShortTitlePattern',
  'quarterlyNoteMediumTitlePattern',
  'yearlyNoteTitlePattern',
  'yearlyNoteShortTitlePattern',
  'yearlyNoteMediumTitlePattern',
  'journalFolderTitle',
  'useFolderNameAsDefaultTitle',
  'defaultCalendarVisibleDesktop',
  'defaultCalendarVisibleMobile',
  'quartersEnabled',
  'includeInTodayPicker',
  'autoTemplateEnabled',
  'taskMigrationPlacement',
  'taskMigrationHeading',
  'taskMigrationHeadingLevel',
] as const satisfies ReadonlyArray<keyof JournalFolderSettings>

type PerFolderField = (typeof PER_FOLDER_FIELDS)[number]

// Computes the front-matter mutation for a save: which kebab-cased keys
// to set, and which to delete. A key is *deleted* when the new value
// matches the global default (so the folder picks up future global
// changes), and *set* otherwise. This keeps `journal-folder.md` front
// matter sparse — only the fields the user has explicitly diverged from
// the global config show up there. Pure function so the diff is testable
// in isolation from `processFrontMatter`.
export function computeFrontMatterDiff(
  newSettings: JournalFolderSettings,
  globalSettings: JournalFolderSettings
): { set: Record<string, unknown>; remove: string[] } {
  const set: Record<string, unknown> = {}
  const remove: string[] = []
  for (const field of PER_FOLDER_FIELDS) {
    const fmKey = kebabCase(field)
    if (areEqual(newSettings[field], globalSettings[field])) {
      remove.push(fmKey)
    } else {
      set[fmKey] = newSettings[field]
    }
  }
  return { set, remove }
}

// Booleans, strings, and the small union types we use here are all
// reference-equal-when-equal under JS `===`, so we keep this trivial.
// Front matter values may arrive as strings ("true"/"false") even when
// the JS field is boolean — normalise the comparison so a "true" in
// front matter doesn't get rewritten as `true` (a no-op semantically)
// every time the user opens the modal.
function areEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'boolean' && typeof b === 'string') {
    return b.trim().toLowerCase() === String(a)
  }
  if (typeof b === 'boolean' && typeof a === 'string') {
    return a.trim().toLowerCase() === String(b)
  }
  return false
}

export type { PerFolderField }
