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

import type { JournalTimeUnit } from '../../data-access'

export interface JournalTasksBlockConfig {
  folders?: string[]
  units?: JournalTimeUnit[]
  showCompleted?: boolean
  maxItems?: number
  // Overrides the `TASKS` header label. Rendered verbatim — the
  // existing CSS uppercases the heading, so a caption typed in mixed
  // case still renders all-caps.
  caption?: string
}

const UNIT_ALIASES: Record<string, JournalTimeUnit> = {
  daily: 'day',
  day: 'day',
  weekly: 'week',
  week: 'week',
  monthly: 'month',
  month: 'month',
  quarterly: 'quarter',
  quarter: 'quarter',
  yearly: 'year',
  year: 'year',
}

// Parses a `journal-tasks` code-block body. Lines are `key: value`,
// commas split list-valued fields. Unknown keys are ignored. The parser
// is intentionally lenient — bad values become "unset" rather than
// throwing, which keeps the in-note error path reserved for genuine
// configuration mistakes (e.g. missing `folders:` on a non-journal host).
export function parseJournalTasksBlock(source: string): JournalTasksBlockConfig {
  const config: JournalTasksBlockConfig = {}
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    const key = line.substring(0, separator).trim().toLowerCase()
    const value = line.substring(separator + 1).trim()
    if (!value) continue
    switch (key) {
      case 'folders':
        config.folders = splitList(value)
        break
      case 'units': {
        const units: JournalTimeUnit[] = []
        for (const token of splitList(value)) {
          const unit = UNIT_ALIASES[token.toLowerCase()]
          if (unit && !units.includes(unit)) units.push(unit)
        }
        if (units.length > 0) config.units = units
        break
      }
      case 'show-completed': {
        const b = parseBoolean(value)
        if (b !== undefined) config.showCompleted = b
        break
      }
      case 'max-items': {
        const n = parseInt(value, 10)
        if (Number.isFinite(n) && n > 0) config.maxItems = n
        break
      }
      case 'caption':
        config.caption = value
        break
    }
  }
  return config
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function parseBoolean(value: string): boolean | undefined {
  const v = value.trim().toLowerCase()
  if (v === 'true') return true
  if (v === 'false') return false
  return undefined
}
