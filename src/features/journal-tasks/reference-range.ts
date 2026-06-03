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

import { moment } from 'obsidian'
import type { JournalNote } from '../../data-access'

export type ReferenceHost = 'sidebar' | 'note'
export type ReferenceMode = 'today' | 'dynamic'

export interface ReferenceRange {
  start: moment.Moment
  end: moment.Moment
}

export interface ReferenceRangeInput {
  host: ReferenceHost
  referenceMode?: ReferenceMode
  activeNote?: JournalNote | null
}

// Returns `[start, end]` of the reference period as inclusive day-aligned
// moments. The contract:
//   sidebar + today                          → today's day
//   sidebar + dynamic + journal active note  → active note's range
//   sidebar + dynamic + non-journal/no leaf  → today's day
//   note    + journal host                   → host note's range
//   note    + non-journal host               → today's day
export function buildReferenceRange(input: ReferenceRangeInput): ReferenceRange {
  const useNote =
    !!input.activeNote &&
    (input.host === 'note' ||
      (input.host === 'sidebar' && input.referenceMode === 'dynamic'))

  if (useNote && input.activeNote) {
    return rangeForNote(input.activeNote)
  }
  return todayRange()
}

export function todayRange(): ReferenceRange {
  // @ts-ignore — obsidian re-exports moment.
  const start = moment().startOf('day')
  return { start, end: start.clone().endOf('day') }
}

export function rangeForNote(note: JournalNote): ReferenceRange {
  const start = note.getMoment().startOf('day')
  const end = start
    .clone()
    .add(1, note.getTimeUnit())
    .subtract(1, 'day')
    .endOf('day')
  return { start, end }
}

// True when `[aStart, aEnd]` and `[bStart, bEnd]` share at least one day.
export function rangesIntersect(a: ReferenceRange, b: ReferenceRange): boolean {
  return !a.end.isBefore(b.start) && !a.start.isAfter(b.end)
}
