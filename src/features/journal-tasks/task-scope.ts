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
