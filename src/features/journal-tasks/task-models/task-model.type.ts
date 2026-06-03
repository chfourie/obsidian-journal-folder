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

import type { TaskStatusId } from '../../../data-access/journal-task'

export type { TaskStatusId }

export interface TaskStatus {
  id: TaskStatusId
  label: string
  // The on-disk character that appears between the brackets (e.g. ' ',
  // 'x', '/', '>', '-'). Stored on the status so a single table drives
  // both parsing and the status-menu UI.
  char: string
  // Lucide icon names — `iconSquare` is rendered when the global
  // `taskCheckboxStyle` is `'square'`, `iconCircle` when `'circle'`.
  iconSquare: string
  iconCircle: string
}

export interface TaskModel {
  id: 'simple' | 'bullet-journal' | 'tasks-plugin'
  // Display order — drives both the right-click status menu and the
  // priority used by `parseLine` (first matching char wins).
  statuses: TaskStatus[]
  parseLine(line: string): { status: TaskStatusId; text: string } | null
  // Returns the full bracketed token (`'[x]'`) for the given status,
  // including the brackets so callers don't have to assemble it.
  serializeStatus(status: TaskStatusId): string
  // Drives the *Show / Hide completed* filter — true for any status that
  // shouldn't appear when the user has hidden completed tasks.
  isDone(status: TaskStatusId): boolean
  // The left-click cycle target for the current status. Only the
  // primary cycle is exposed here; access to other statuses goes
  // through the right-click / long-press status menu, which lists
  // every entry in `statuses`.
  nextStatus(current: TaskStatusId): TaskStatusId
}
