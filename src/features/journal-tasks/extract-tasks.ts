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
import type {
  JournalNote,
  JournalTask,
  Signifier,
  TaskCategory,
} from '../../data-access'
import {
  extractTags,
  matchCategories,
  matchSignifiers,
  stripTags,
} from '../../data-access'
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
  return input.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match: string, target: string, alias?: string) => (alias ?? target).trim()
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Removes migration cross-references (`<marker> [[link]]`) from the task
// text so the plugin's own task lists stay clean — the source-note chip
// already shows provenance, and a raw `lucide:…` token would otherwise
// read as literal text. Each configured marker followed by a wikilink is
// dropped (marker + link). Reading-view rendering is unaffected: it works
// off the raw markdown, not this display text. Exported for testing.
export function stripMigrationReferences(
  text: string,
  markers: string[]
): string {
  let out = text
  for (const marker of markers) {
    const trimmed = marker.trim()
    if (!trimmed) continue
    out = out.replace(
      new RegExp(`\\s*${escapeRegExp(trimmed)}\\s*\\[\\[[^\\]]*\\]\\]`, 'g'),
      ''
    )
  }
  return out.replace(/\s+$/, '')
}

// Pure helper — given file content, the active model, the source TFile,
// and a pre-built JournalNote describing the file's tier, returns every
// task in the file. Lines that don't parse as tasks for `model` are
// silently skipped.
export function extractTasks(
  content: string,
  model: TaskModel,
  file: TFile,
  journalNote: JournalNote,
  migrationMarkers: string[] = [],
  signifiers: readonly Signifier[] = [],
  categories: readonly TaskCategory[] = []
): JournalTask[] {
  const lines = content.split('\n')
  const noteUnit = journalNote.getTimeUnit()
  const noteRangeDays = DAYS_PER_UNIT[noteUnit]
  const noteTitleShort = journalNote.link('short').title
  const noteTitle = journalNote.getTitle()
  const folderPath = file.parent?.path ?? ''
  const tasks: JournalTask[] = []
  for (let i = 0; i < lines.length; i++) {
    const parsed = model.parseLine(lines[i])
    if (!parsed) continue
    // Match signifiers / categories against the tags on the task text,
    // then strip those matched tags from the display text so they don't
    // surface as raw `#important`. Unmatched tags are left in place.
    const tags = extractTags(parsed.text)
    const matchedSignifiers = matchSignifiers(tags, signifiers)
    const matchedCategories = matchCategories(tags, categories)
    const tagsToStrip = [
      ...matchedSignifiers.flatMap((s) => s.tags),
      ...matchedCategories.flatMap((c) => c.tags),
    ]
    tasks.push({
      sourceFile: file,
      sourceLine: i,
      rawText: lines[i],
      displayText: stripWikilinkSyntax(
        stripTags(
          stripMigrationReferences(parsed.text, migrationMarkers),
          tagsToStrip
        )
      ),
      status: parsed.status,
      noteUnit,
      noteRangeDays,
      noteTitleShort,
      noteTitle,
      folderPath,
      signifierIds: matchedSignifiers.map((s) => s.id),
      categoryIds: matchedCategories.map((c) => c.id),
    })
  }
  return tasks
}
