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
// cap flooring).
export const RANGE_UNIT_RANK: Record<ReferenceRangeUnit, number> = {
  day: 0,
  week: 1,
  month: 2,
  quarter: 3,
  year: 4,
  all: 5,
}

// The larger (coarser) of two range units.
export function largerRangeUnit(
  a: ReferenceRangeUnit,
  b: ReferenceRangeUnit
): ReferenceRangeUnit {
  return RANGE_UNIT_RANK[a] >= RANGE_UNIT_RANK[b] ? a : b
}

export interface ReferenceRangeInput {
  host: ReferenceHost
  // Sidebar only — the in-note block (`host: 'note'`) ignores these and
  // always follows its host note's own period.
  anchor?: ReferenceAnchor
  range?: ReferenceRangeUnit
  activeNote?: JournalNote | null
}

// Returns `[start, end]` of the reference period as inclusive
// day-aligned moments. The contract:
//   sidebar + range 'all'                    → unbounded (everything)
//   sidebar + anchor today + range r         → the r-period containing today
//   sidebar + anchor note  + range r         → the r-period containing the
//                                              active note (today if none)
//   note host                                → host note's own range
//                                              (today for non-journal hosts)
export function buildReferenceRange(input: ReferenceRangeInput): ReferenceRange {
  // The in-note block always tracks its host note's own tier range.
  if (input.host === 'note') {
    return input.activeNote ? rangeForNote(input.activeNote) : todayRange()
  }
  if (input.range === 'all') return allTimeRange()
  // Anchored on the active note, the window's floor is the note's OWN tier.
  // A note bigger than a day spans a date *range*, not a single anchor date,
  // so a configured range smaller than the note would collapse to a nonsense
  // sub-window (a monthly note "anchored" at the 1st showing only the 1st's
  // daily notes). Clamp the unit up to the note's tier — the note's own
  // period is the smallest sensible window when measuring from it.
  if (input.anchor === 'note' && input.activeNote) {
    const noteUnit = input.activeNote.getTimeUnit()
    const unit = largerRangeUnit(input.range ?? 'day', noteUnit)
    return unit === noteUnit
      ? rangeForNote(input.activeNote)
      : // `unit` is never `all` here (range !== 'all', noteUnit is day–year).
        periodAround(
          input.activeNote.getMoment(),
          unit as moment.unitOfTime.StartOf
        )
  }
  return periodAround(
    // @ts-ignore — obsidian re-exports moment.
    moment(),
    input.range ?? 'day'
  )
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
  // @ts-ignore — obsidian re-exports moment.
  return periodAround(moment(), unit)
}

// A range so wide every realistic note period intersects it — used by
// the `'all'` range to disable date filtering without special-casing
// the intersection test downstream.
export function allTimeRange(): ReferenceRange {
  return {
    // @ts-ignore — obsidian re-exports moment.
    start: moment('0001-01-01').startOf('day'),
    // @ts-ignore — obsidian re-exports moment.
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
