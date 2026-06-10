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
import {
  type JournalFolderSettings,
  type JournalNote,
  type JournalNoteFactory,
  journalNoteFactoryWithSettings,
  type JournalTimeUnit,
  journalUnitForBasename,
  type TasksSidebarFolderMode,
} from '../../data-access'
import {
  rangeForNote,
  rangesIntersect,
  type ReferenceRange,
} from './reference-range'

export interface TaskCandidate {
  file: TFile
  note: JournalNote
}

export interface FindCandidatesInput {
  app: App
  folders: string[]
  units: JournalTimeUnit[]
  referenceRange: ReferenceRange
  settings: JournalFolderSettings
}

// Walks every markdown file directly under the given `folders`, keeps the
// ones whose basename is a recognised journal pattern for one of the
// requested `units`, then narrows to the subset whose period intersects
// `referenceRange`. Each surviving file is paired with its `JournalNote`
// so downstream callers don't have to rebuild it.
export function findTaskCandidates(
  input: FindCandidatesInput
): TaskCandidate[] {
  const factory: JournalNoteFactory = journalNoteFactoryWithSettings(
    input.settings
  )
  const unitSet = new Set<JournalTimeUnit>(input.units)
  const quartersEnabled = !!input.settings.quartersEnabled
  const results: TaskCandidate[] = []

  for (const folderPath of input.folders) {
    const folder = input.app.vault.getAbstractFileByPath(
      folderPath === '' || folderPath === '/' ? '/' : folderPath
    )
    if (!(folder instanceof TFolder)) continue
    for (const child of folder.children) {
      if (!(child instanceof TFile)) continue
      if (child.extension !== 'md') continue
      const unit = journalUnitForBasename(child.basename, quartersEnabled)
      if (!unit || !unitSet.has(unit)) continue
      let note: JournalNote
      try {
        note = factory(child)
      } catch {
        continue
      }
      const noteRange = rangeForNote(note)
      if (!rangesIntersect(noteRange, input.referenceRange)) continue
      results.push({ file: child, note })
    }
  }

  return results
}

export interface ResolveFoldersInput {
  folderMode: TasksSidebarFolderMode
  // The folder scanned when `folderMode` is `'specific'`.
  folder: string
  // The active journal note's parent-folder path, or `null` when the
  // active leaf isn't a recognised journal note.
  activeNoteFolder: string | null
  // Every known journal folder (the `'all'` fallback). A thunk because
  // producing the list costs a full-vault walk (`findJournalFolderPaths`
  // scans every markdown file) — it must only run when a branch below
  // actually needs it.
  allFolders: () => string[]
}

// Resolves which folder path(s) a sidebar task panel should scan from
// its folder-scope setting and the active leaf. Folder scope is fully
// independent of the reference anchor. Rules:
//   - folder mode `'note'` → active note's folder.
//   - folder mode `'specific'` with a folder → that single folder.
//   - folder mode `'all'` → every known journal folder.
// `'note'` with no active journal note (and `'specific'` with no
// folder) fall back to all folders.
export function resolveTaskFolders(input: ResolveFoldersInput): string[] {
  if (input.folderMode === 'note') {
    return input.activeNoteFolder !== null
      ? [input.activeNoteFolder]
      : input.allFolders()
  }
  if (input.folderMode === 'specific' && input.folder) {
    return [input.folder]
  }
  return input.allFolders()
}

// Lists the journal notes that live directly under `folderPath`, sorted
// by date descending (newest first) so a migration target picker shows
// the most likely destinations at the top. `excludePath` drops the
// source note from the list (you don't migrate a note's tasks into
// itself). Non-journal markdown and the `journal-folder.md` config note
// are skipped via the basename pattern check. Migration is single-folder
// by design, so this is the canonical destination candidate set.
export function listJournalNotesInFolder(input: {
  app: App
  folderPath: string
  settings: JournalFolderSettings
  excludePath?: string
}): TFile[] {
  const { app, folderPath, settings, excludePath } = input
  const factory: JournalNoteFactory = journalNoteFactoryWithSettings(settings)
  const quartersEnabled = !!settings.quartersEnabled
  const folder = app.vault.getAbstractFileByPath(
    folderPath === '' || folderPath === '/' ? '/' : folderPath
  )
  if (!(folder instanceof TFolder)) return []
  const matches: { file: TFile; note: JournalNote }[] = []
  for (const child of folder.children) {
    if (!(child instanceof TFile) || child.extension !== 'md') continue
    if (child.path === excludePath) continue
    if (!journalUnitForBasename(child.basename, quartersEnabled)) continue
    try {
      matches.push({ file: child, note: factory(child) })
    } catch {
      // Basename passed the unit check but the factory rejected it —
      // skip rather than surface a half-built note.
    }
  }
  return matches
    .sort((a, b) => b.note.getMoment().valueOf() - a.note.getMoment().valueOf())
    .map((m) => m.file)
}

export const ALL_UNITS: JournalTimeUnit[] = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
]

// Returns the subset of `ALL_UNITS` that the current settings actually
// allow. Quarters drop out when `quartersEnabled` is false.
export function effectiveUnits(
  settings: JournalFolderSettings
): JournalTimeUnit[] {
  return ALL_UNITS.filter(
    (u) => u !== 'quarter' || !!settings.quartersEnabled
  )
}
