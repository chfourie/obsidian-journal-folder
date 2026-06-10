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

// Line-by-line fenced-code-block state tracker shared by `extractTasks`
// and `findDocumentTaskLines`. The two MUST agree on which lines are
// fence content: the reading-view renderer emits no `li.task-list-item`
// for fenced lines, so if either parser counted a fenced `- [ ] …` line
// as a task, the positional zip between parsed lines and rendered items
// would drift — and a status click could rewrite a line inside a code
// block. Keeping the rule in one helper keeps the surfaces in lockstep.
//
// Rules (and deliberate divergences from strict CommonMark):
// - ``` and ~~~ both open a fence (3+ delimiter chars).
// - A fence opener is recognised at ANY indentation, not CommonMark's
//   0–3 spaces. Fences nested inside list items carry the list's indent
//   (often 4+ spaces), and a line-based scanner has no container context
//   to tell that apart from an indented code block. Missing a fence
//   risks rewriting code-block content via a task-status click, while
//   over-matching merely hides task-like lines inside an indented code
//   block — the safer failure.
// - A backtick opener whose info string contains a backtick is not a
//   fence (per CommonMark — that's inline code, e.g. a ```code``` span
//   alone on a line).
// - The closer must use the same character, at least as many of them,
//   and carry nothing but whitespace after (per CommonMark).
// - An unclosed fence runs to end of input.
// - Fences inside blockquotes (`> ```) are out of scope: the `>` prefix
//   means neither the fence nor its content matches the task regex, so
//   no zip drift is possible there.

export interface FenceTracker {
  /**
   * Feed the next line of the document in order. Returns true when the
   * line is fenced-code content (opening/closing delimiter lines
   * included) and must be skipped by task parsing.
   */
  next(line: string): boolean
}

const FENCE_OPEN = /^\s*(`{3,}|~{3,})(.*)$/
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/

export function createFenceTracker(): FenceTracker {
  let open: { char: string; length: number } | null = null
  return {
    next(line) {
      if (open) {
        const close = FENCE_CLOSE.exec(line)
        if (
          close &&
          close[1].startsWith(open.char) &&
          close[1].length >= open.length
        ) {
          open = null
        }
        return true
      }
      const start = FENCE_OPEN.exec(line)
      if (start) {
        const char = start[1][0]
        if (char === '`' && start[2].includes('`')) return false
        open = { char, length: start[1].length }
        return true
      }
      return false
    },
  }
}
