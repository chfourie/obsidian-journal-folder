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

import type { TaskStatusId } from '../../data-access'
import type { TaskModel } from './task-models'

export interface DocumentTaskLine {
  line: number
  status: TaskStatusId
}

// Walks the section [`lineStart`, `lineEnd`] inclusive of `fullText`
// and returns every line that parses as a task for the active model,
// paired with its absolute file line index. Pure so we can unit-test
// the zip-by-order contract the post-processor relies on without
// touching the DOM. The reading-view / live-preview renderer emits
// `<li class="task-list-item">` elements in source order, so a
// positional zip of this result against the rendered items is safe.
export function findDocumentTaskLines(
  fullText: string,
  lineStart: number,
  lineEnd: number,
  model: TaskModel
): DocumentTaskLine[] {
  const lines = fullText.split('\n')
  const out: DocumentTaskLine[] = []
  const end = Math.min(lineEnd, lines.length - 1)
  for (let i = Math.max(0, lineStart); i <= end; i++) {
    const parsed = model.parseLine(lines[i])
    if (parsed) out.push({ line: i, status: parsed.status })
  }
  return out
}
