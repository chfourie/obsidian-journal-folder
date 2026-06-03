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

import type { TaskModel, TaskStatus, TaskStatusId } from './task-model.type'
import { TASK_LINE_REGEX } from './task-line-regex'

const STATUSES: TaskStatus[] = [
  {
    id: 'open',
    label: 'Open',
    char: ' ',
    iconSquare: 'square',
    iconCircle: 'circle',
  },
  {
    id: 'in-progress',
    label: 'In progress',
    char: '/',
    iconSquare: 'square-dot',
    iconCircle: 'circle-dot',
  },
  {
    id: 'done',
    label: 'Done',
    char: 'x',
    iconSquare: 'square-check',
    iconCircle: 'circle-check',
  },
  {
    id: 'migrated',
    label: 'Migrated',
    char: '>',
    iconSquare: 'square-chevron-right',
    iconCircle: 'circle-chevron-right',
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    char: '-',
    iconSquare: 'square-x',
    iconCircle: 'circle-x',
  },
]

const DONE_STATUSES: ReadonlySet<TaskStatusId> = new Set([
  'done',
  'migrated',
  'cancelled',
])

function statusForChar(char: string): TaskStatus | undefined {
  const lower = char.toLowerCase()
  return STATUSES.find((s) => s.char === lower)
}

function statusForId(id: TaskStatusId): TaskStatus | undefined {
  return STATUSES.find((s) => s.id === id)
}

// Primary left-click cycle: open → in-progress → done → open. Migrated
// and cancelled are accessible only through the right-click status menu
// so the most common state transitions stay one click away.
const CYCLE: Record<TaskStatusId, TaskStatusId> = {
  open: 'in-progress',
  'in-progress': 'done',
  done: 'open',
  migrated: 'open',
  cancelled: 'open',
}

export const bulletJournalTaskModel: TaskModel = {
  id: 'bullet-journal',
  statuses: STATUSES,
  parseLine(line) {
    const match = TASK_LINE_REGEX.exec(line)
    if (!match) return null
    const status = statusForChar(match[2])
    if (!status) return null
    return { status: status.id, text: match[3] }
  },
  serializeStatus(status) {
    const entry = statusForId(status)
    if (!entry) {
      throw new Error(`Unknown bullet-journal-model status: ${status}`)
    }
    return `[${entry.char}]`
  },
  isDone(status) {
    return DONE_STATUSES.has(status)
  },
  nextStatus(current) {
    return CYCLE[current] ?? 'open'
  },
}
