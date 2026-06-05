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

import type { TFile } from 'obsidian'
import type { JournalTimeUnit } from './journal-note'

// Opaque to the core — each TaskModel defines its own identifiers and
// the character mapping that backs them. Treating this as a plain string
// keeps the door open for a future Tasks-plugin model that allows
// user-defined statuses.
export type TaskStatusId = string

export interface JournalTask {
  sourceFile: TFile
  // Zero-based line index inside `sourceFile`.
  sourceLine: number
  // The raw line text as it appears on disk (incl. bullet + checkbox).
  rawText: string
  // Display-friendly text for the task — wikilink syntax stripped to a
  // visible label, list bullet and checkbox removed.
  displayText: string
  status: TaskStatusId
  noteUnit: JournalTimeUnit
  // Number of calendar days the source note's period covers. Drives the
  // ascending sort so daily tasks always come before weekly etc.
  noteRangeDays: number
  // Short title used in the muted chip beside the task (e.g. `2026-06-03`
  // for a daily note, `W23` for a weekly note).
  noteTitleShort: string
  // Full title rendered via the active tier's `titlePattern` (e.g.
  // `Wednesday, 03 June 2026` for a daily note). Used as the
  // sub-heading text in the grouped task list view — there's
  // enough horizontal room above a stack of tasks to spell the
  // date out properly.
  noteTitle: string
  folderPath: string
  // Ids of the configured signifiers whose tags appear on this task line,
  // in signifier-configuration order. Drives the inline signifier icons
  // shown in the plugin's task lists. The matched tags are stripped from
  // `displayText`.
  signifierIds: string[]
  // Ids of the configured task categories whose tags appear on this task
  // line. A task is listed under every matching category. The matched
  // tags are stripped from `displayText`.
  categoryIds: string[]
}
