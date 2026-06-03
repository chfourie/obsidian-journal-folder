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

import { type App, Notice } from 'obsidian'
import type { JournalTask, TaskStatusId } from '../../data-access'
import type { TaskModel } from './task-models'

const STALE_MESSAGE = 'Task no longer at expected location — refreshing'

// Replaces the status token (`[?]`) on the source line, leaving
// indentation, bullet, and trailing text byte-for-byte. Aborts with a
// Notice when the line at `task.sourceLine` no longer parses as a task
// with the same prior status — the cache is stale and a re-scan should
// happen before the user tries again.
export async function setTaskStatus(
  app: App,
  task: JournalTask,
  nextStatus: TaskStatusId,
  model: TaskModel
): Promise<void> {
  await app.vault.process(task.sourceFile, (content) => {
    const lines = content.split('\n')
    const line = lines[task.sourceLine]
    if (line === undefined) {
      new Notice(STALE_MESSAGE)
      return content
    }
    const parsed = model.parseLine(line)
    if (!parsed || parsed.status !== task.status) {
      new Notice(STALE_MESSAGE)
      return content
    }
    const replacement = model.serializeStatus(nextStatus)
    const updatedLine = line.replace(/\[(.)\]/, replacement)
    lines[task.sourceLine] = updatedLine
    return lines.join('\n')
  })
}

export async function cycleTaskStatus(
  app: App,
  task: JournalTask,
  model: TaskModel
): Promise<void> {
  await setTaskStatus(app, task, model.nextStatus(task.status), model)
}
