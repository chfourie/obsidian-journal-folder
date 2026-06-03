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

// Two-state look: outline ring for open, filled accent circle with a
// white check for done. Pairs cleanly with most themes and reads
// well at the panel font sizes the plugin renders at.
const STATUSES: TaskStatus[] = [
  {
    id: 'open',
    label: 'Open',
    char: ' ',
    isDone: false,
    shell: {
      shape: 'circle',
      background: undefined,
      border: { color: { kind: 'token', var: '--text-faint' }, width: 2 },
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
]

function statusForChar(char: string): TaskStatus | undefined {
  const lower = char.toLowerCase()
  return STATUSES.find((s) => s.char === lower)
}

function statusForId(id: TaskStatusId): TaskStatus | undefined {
  return STATUSES.find((s) => s.id === id)
}

export const simpleTaskModel: TaskModel = {
  id: 'simple',
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
    if (!entry) throw new Error(`Unknown simple-model status: ${status}`)
    return `[${entry.char}]`
  },
  isDone(status) {
    return statusForId(status)?.isDone ?? false
  },
  nextStatus(current) {
    return current === 'open' ? 'done' : 'open'
  },
}
