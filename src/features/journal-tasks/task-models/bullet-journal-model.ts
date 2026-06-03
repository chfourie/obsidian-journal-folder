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

// Visual defaults mirror the semantic-colour reference layout: outline
// ring for open, soft fill for in-progress, accent-coloured filled
// circles with white glyphs for done / cancelled, bare coloured
// chevron for migrated. Every colour resolves through theme tokens
// so the icons follow the user's active theme automatically.
const STATUSES: TaskStatus[] = [
  {
    id: 'open',
    label: 'Open',
    char: ' ',
    isDone: false,
    shell: {
      shape: 'circle',
      background: undefined,
      border: {
        color: { kind: 'token', var: '--background-modifier-border' },
        width: 1.5,
      },
    },
    icon: { source: { kind: 'none' } },
  },
  {
    id: 'in-progress',
    label: 'In progress',
    char: '/',
    isDone: false,
    shell: {
      shape: 'circle',
      background: { kind: 'token', var: '--background-modifier-border' },
      border: null,
    },
    icon: { source: { kind: 'none' } },
  },
  {
    id: 'done',
    label: 'Done',
    char: 'x',
    isDone: true,
    shell: {
      shape: 'circle',
      background: { kind: 'token', var: '--color-green' },
      border: null,
    },
    icon: {
      source: { kind: 'lucide', name: 'check' },
      color: { kind: 'token', var: '--text-on-accent' },
      inset: 0.7,
    },
  },
  {
    id: 'migrated',
    label: 'Migrated',
    char: '>',
    isDone: true,
    shell: { shape: 'none' },
    icon: {
      // `redo-2` is a thick curved-forward arrow — reads as
      // "moved on" more strongly than the small `corner-up-right`
      // stair-step chevron. No shell, so inset 1 fills the whole
      // shell box for parity in size with the filled circles next
      // to it.
      source: { kind: 'lucide', name: 'redo-2' },
      color: { kind: 'token', var: '--color-blue' },
      inset: 1,
    },
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    char: '-',
    isDone: true,
    shell: {
      shape: 'circle',
      background: { kind: 'token', var: '--color-red' },
      border: null,
    },
    icon: {
      source: { kind: 'lucide', name: 'x' },
      color: { kind: 'token', var: '--text-on-accent' },
      inset: 0.7,
    },
  },
]

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
    return statusForId(status)?.isDone ?? false
  },
  nextStatus(current) {
    return CYCLE[current] ?? 'open'
  },
}
