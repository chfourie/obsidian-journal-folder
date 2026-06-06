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
import type {
  JournalTask,
  TaskCategory,
  TaskCategoryRange,
} from '../../data-access'
import {
  type ReferenceRange,
  type ReferenceRangeUnit,
  periodAround,
  rangesIntersect,
} from './reference-range'

// Calendar size order, smallest → largest. Drives both "which cap is
// smallest" and "does the cap bite" (is it smaller than the list range).
const UNIT_SIZE: Record<ReferenceRangeUnit, number> = {
  day: 0,
  week: 1,
  month: 2,
  quarter: 3,
  year: 4,
  all: 5,
}

// Builds `categoryId → maxRange` for the capped categories only.
export function rangeCapsByCategory(
  categories: readonly TaskCategory[]
): Map<string, TaskCategoryRange> {
  const caps = new Map<string, TaskCategoryRange>()
  for (const c of categories) if (c.maxRange) caps.set(c.id, c.maxRange)
  return caps
}

// The smallest cap among a task's categories, or null when none of its
// categories is capped. "Smallest wins" — a task in both a day-capped and
// a month-capped category is bound by the day cap.
export function smallestTaskCap(
  task: Pick<JournalTask, 'categoryIds'>,
  capsById: Map<string, TaskCategoryRange>
): TaskCategoryRange | null {
  let best: TaskCategoryRange | null = null
  for (const id of task.categoryIds) {
    const cap = capsById.get(id)
    if (!cap) continue
    if (best === null || UNIT_SIZE[cap] < UNIT_SIZE[best]) best = cap
  }
  return best
}

// Builds a per-task predicate that enforces category range caps for one
// list render. The list passes its own anchor `base` moment and `listUnit`
// (the range it's showing — `'all'` for the unbounded view). For a task
// whose smallest cap is **smaller** than the list range, inclusion is
// re-tested against the capped period (anchored at `base`) instead of the
// list range; otherwise the cap doesn't bite and the task is left to the
// list's normal range handling (it already passed candidate filtering).
// Capped reference ranges are memoised per unit. Pure aside from reading
// the supplied moment.
export function makeRangeCapFilter(opts: {
  base: moment.Moment
  listUnit: ReferenceRangeUnit
  categories: readonly TaskCategory[]
}): (task: Pick<JournalTask, 'categoryIds'>, noteRange: ReferenceRange) => boolean {
  const capsById = rangeCapsByCategory(opts.categories)
  const listSize = UNIT_SIZE[opts.listUnit]
  const refByUnit = new Map<TaskCategoryRange, ReferenceRange>()

  return (task, noteRange) => {
    const cap = smallestTaskCap(task, capsById)
    if (!cap) return true
    // Cap only constrains when it's strictly smaller than the list range
    // (or the list is the unbounded `all`). Otherwise the list range is
    // already at least as tight, so leave the task to normal filtering.
    if (UNIT_SIZE[cap] >= listSize) return true
    let ref = refByUnit.get(cap)
    if (!ref) {
      ref = periodAround(opts.base, cap)
      refByUnit.set(cap, ref)
    }
    return rangesIntersect(noteRange, ref)
  }
}
