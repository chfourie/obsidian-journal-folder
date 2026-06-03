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

import type {
  TaskModel,
  TaskStatus,
  TaskStatusId,
} from '../../../data-access/task-model.type'
import { TASK_LINE_REGEX } from './task-line-regex'

// Builds a `TaskModel` from a user-edited (or built-in) status
// array. The model is a pure function over the array — no global
// state, no shared mutable refs — so cache invalidation only needs
// to compare `model.id`.
export function buildTaskModel(statuses: TaskStatus[]): TaskModel {
  const byChar = new Map<string, TaskStatus>()
  const byId = new Map<TaskStatusId, TaskStatus>()
  for (const s of statuses) {
    // Earlier entries win on duplicate chars — mirrors the
    // "first matching char wins" rule documented on `TaskModel`.
    if (!byChar.has(s.char.toLowerCase())) byChar.set(s.char.toLowerCase(), s)
    if (!byId.has(s.id)) byId.set(s.id, s)
  }

  const fallbackId = statuses[0]?.id ?? 'open'

  // The cache key bakes in everything that affects parsed output:
  // the alphabet, the isDone bit, and the next-status link (so
  // changing the cycle doesn't strand a stale cached cycle target).
  // Pure visual changes (colour, shell) are intentionally excluded
  // — they don't influence parsed `JournalTask` data.
  const id =
    'model:' +
    statuses
      .map((s) => `${s.char}|${s.isDone ? '1' : '0'}|${s.next}`)
      .join(',')

  return {
    id,
    statuses,
    parseLine(line) {
      const match = TASK_LINE_REGEX.exec(line)
      if (!match) return null
      const status = byChar.get(match[2].toLowerCase())
      if (!status) return null
      return { status: status.id, text: match[3] }
    },
    serializeStatus(statusId) {
      const entry = byId.get(statusId)
      if (!entry) {
        throw new Error(`Unknown task status: ${statusId}`)
      }
      return `[${entry.char}]`
    },
    isDone(statusId) {
      return byId.get(statusId)?.isDone ?? false
    },
    nextStatus(current) {
      const entry = byId.get(current)
      if (!entry) return fallbackId
      // Per-status `next` may point at a status that no longer
      // exists (e.g. the user removed it). Fall back to the first
      // status so the cycle still terminates somewhere sensible.
      return byId.has(entry.next) ? entry.next : fallbackId
    },
  }
}
