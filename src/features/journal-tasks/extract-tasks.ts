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
import type { JournalNote, JournalTask } from '../../data-access'
import type { TaskModel } from './task-models'

// Number of calendar days each tier covers. Used for sorting (smaller =
// higher priority in the list) and for the chip's short-title selection.
const DAYS_PER_UNIT = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
} as const

// Strips `[[wikilink]]` syntax down to a display label: the alias when
// present (`[[a|b]]` → `b`), else the target (`[[a]]` → `a`). Markdown
// links and inline code are left alone — they render fine as plain text
// in the chip-less single-line list view.
function stripWikilinkSyntax(input: string): string {
  return input.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) =>
    (alias ?? target).trim()
  )
}

// Pure helper — given file content, the active model, the source TFile,
// and a pre-built JournalNote describing the file's tier, returns every
// task in the file. Lines that don't parse as tasks for `model` are
// silently skipped.
export function extractTasks(
  content: string,
  model: TaskModel,
  file: TFile,
  journalNote: JournalNote
): JournalTask[] {
  const lines = content.split('\n')
  const noteUnit = journalNote.getTimeUnit()
  const noteRangeDays = DAYS_PER_UNIT[noteUnit]
  const noteTitleShort = journalNote.link('short').title
  const folderPath = file.parent?.path ?? ''
  const tasks: JournalTask[] = []
  for (let i = 0; i < lines.length; i++) {
    const parsed = model.parseLine(lines[i])
    if (!parsed) continue
    tasks.push({
      sourceFile: file,
      sourceLine: i,
      rawText: lines[i],
      displayText: stripWikilinkSyntax(parsed.text),
      status: parsed.status,
      noteUnit,
      noteRangeDays,
      noteTitleShort,
      folderPath,
    })
  }
  return tasks
}
