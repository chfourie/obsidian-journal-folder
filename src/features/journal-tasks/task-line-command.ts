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

import type { TaskModel } from './task-models'

// A bullet list line that does *not* already carry a checkbox token.
// (Lines that do are handled by the model's own parse path.)
const LIST_ITEM_REGEX = /^(\s*)([-*+])\s+(.*)$/
const INDENT_REGEX = /^(\s*)(.*)$/

// Turns a plain line into a top-level task line stamped with
// `statusToken` (e.g. `[ ]`), preserving leading indentation. An
// existing list bullet is reused; anything else gains a `-` bullet.
export function lineToTaskMarkdown(line: string, statusToken: string): string {
  const listMatch = LIST_ITEM_REGEX.exec(line)
  if (listMatch) {
    const [, indent, bullet, rest] = listMatch
    return `${indent}${bullet} ${statusToken} ${rest}`
  }
  const indentMatch = INDENT_REGEX.exec(line)
  const indent = indentMatch?.[1] ?? ''
  const rest = indentMatch?.[2] ?? ''
  return `${indent}- ${statusToken} ${rest}`
}

// Computes the rewritten line for the "toggle task / advance status"
// command. When the line is already a task the model recognises, the
// status token is replaced with the flow's next status; otherwise the
// line is converted into a task at the flow's first status. Returns
// `null` only when the active flow has no statuses (so the caller can
// leave the line untouched).
export function computeTaskLineEdit(
  line: string,
  model: TaskModel
): string | null {
  const parsed = model.parseLine(line)
  if (parsed) {
    const next = model.nextStatus(parsed.status)
    return line.replace(/\[(.)\]/, model.serializeStatus(next))
  }
  const firstStatus = model.statuses[0]?.id
  if (firstStatus === undefined) return null
  return lineToTaskMarkdown(line, model.serializeStatus(firstStatus))
}
