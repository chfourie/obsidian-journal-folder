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

import { moment } from '../../data-access'
import type { JournalNote } from '../../data-access'

export type ReferenceHost = 'sidebar' | 'note'
// The sidebar reference is two orthogonal axes: an *anchor* (the point
// the window is measured from) and a *range* (the window size).
export type ReferenceAnchor = 'today' | 'note'
export type ReferenceRangeUnit =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'all'

export interface ReferenceRange {
  start: moment.Moment
  end: moment.Moment
}

// Calendar size order of the range units, smallest → largest. Single source
// of truth for "which unit is bigger" comparisons (range clamping + category
// cap selection).
export const RANGE_UNIT_RANK: Record<ReferenceRangeUnit, number> = {
  day: 0,
  week: 1,
  month: 2,
  quarter: 3,
  year: 4,
  all: 5,
}

export interface ReferenceRangeInput {
  host: ReferenceHost
  // Sidebar only — the in-note block (`host: 'note'`) ignores these and
  // always follows its host note's own period.
  anchor?: ReferenceAnchor
  range?: ReferenceRangeUnit
  activeNote?: JournalNote | null
}

// The anchor as a genuine date *range* (not a single point):
//   today → a single day `[today, today]`
//   note  → the active note's whole period (today when there's no note)
// The range setting is applied to this span by `expandRange`.
export function anchorRange(input: {
  anchor?: ReferenceAnchor
  activeNote?: JournalNote | null
}): ReferenceRange {
  return input.anchor === 'note' && input.activeNote
    ? rangeForNote(input.activeNote)
    : todayRange()
}

// Widens `anchor` so each endpoint sits on its `unit` calendar boundary.
// This is the materialised union of `periodAround(d, unit)` for every day
// `d` in `[anchor.start, anchor.end]`: those per-day windows are contiguous,
// so their union is just the outer envelope — two boundary snaps, no loop.
// `'all'` drops date filtering entirely.
export function expandRange(
  anchor: ReferenceRange,
  unit: ReferenceRangeUnit
): ReferenceRange {
  if (unit === 'all') return allTimeRange()
  const u = unit as moment.unitOfTime.StartOf
  return {
    start: anchor.start.clone().startOf(u),
    end: anchor.end.clone().endOf(u),
  }
}

// Returns `[start, end]` of the reference period as inclusive
// day-aligned moments. The contract:
//   sidebar + range 'all'                    → unbounded (everything)
//   sidebar + anchor today + range r         → the r-period containing today
//   sidebar + anchor note  + range r         → the r-period(s) spanning the
//                                              active note's whole period
//                                              (today if none)
//   note host                                → host note's own range
//                                              (today for non-journal hosts)
export function buildReferenceRange(input: ReferenceRangeInput): ReferenceRange {
  // The in-note block always tracks its host note's own tier range.
  if (input.host === 'note') {
    return input.activeNote ? rangeForNote(input.activeNote) : todayRange()
  }
  return expandRange(anchorRange(input), input.range ?? 'day')
}

// `[start, end]` of the calendar period of `unit` size that contains
// `base`. Week boundaries honour the locale's first day of the week,
// which the plugin sets via `applyStartOfWeek`.
export function periodAround(
  base: moment.Moment,
  unit: moment.unitOfTime.StartOf
): ReferenceRange {
  const start = base.clone().startOf(unit)
  return { start, end: start.clone().endOf(unit) }
}

// `[start, end]` of the current calendar period for `unit` (the period
// containing today).
export function currentPeriodRange(
  unit: moment.unitOfTime.StartOf
): ReferenceRange {
  return periodAround(moment(), unit)
}

// A range so wide every realistic note period intersects it — used by
// the `'all'` range to disable date filtering without special-casing
// the intersection test downstream.
export function allTimeRange(): ReferenceRange {
  return {
    start: moment('0001-01-01').startOf('day'),
    end: moment('9999-12-31').endOf('day'),
  }
}

export function todayRange(): ReferenceRange {
  return currentPeriodRange('day')
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
