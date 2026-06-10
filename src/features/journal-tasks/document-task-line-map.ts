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
import { createFenceTracker } from './fence-tracker'

export interface DocumentTaskLine {
  line: number
  status: TaskStatusId
}

// Walks the section [`lineStart`, `lineEnd`] inclusive of `lines`
// (the file's pre-split lines — callers split once per render, not
// per block; post-processors run per block per render, so re-splitting
// here was O(blocks × file length)) and returns every line that parses
// as a task for the active model, paired with its absolute file line
// index. Pure so we can unit-test the zip-by-order contract the
// post-processor relies on without touching the DOM. The reading-view
// / live-preview renderer emits `<li class="task-list-item">` elements
// in source order, so a positional zip of this result against the
// rendered items is safe. Lines inside fenced code blocks are skipped
// — the renderer emits no task item for them, so counting them would
// desync the zip. Fence state is tracked from line 0 (not `lineStart`)
// so this function and `extractTasks` agree on the fence status of
// every absolute line.
export function findDocumentTaskLines(
  lines: readonly string[],
  lineStart: number,
  lineEnd: number,
  model: TaskModel
): DocumentTaskLine[] {
  const out: DocumentTaskLine[] = []
  const end = Math.min(lineEnd, lines.length - 1)
  const first = Math.max(0, lineStart)
  const fence = createFenceTracker()
  for (let i = 0; i <= end; i++) {
    const inFence = fence.next(lines[i])
    if (inFence || i < first) continue
    const parsed = model.parseLine(lines[i])
    if (parsed) out.push({ line: i, status: parsed.status })
  }
  return out
}
