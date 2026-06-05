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

import {
  type Signifier,
  extractTags,
  matchSignifiers,
  stripTags,
} from '../../data-access'

// Pure helper backing the "modify signifiers on current line" command.
// Given a line, the configured signifiers, and the set of signifier ids
// that should be present afterwards, returns the rewritten line:
//   * a newly-selected signifier whose tags aren't on the line gets its
//     PRIMARY tag (`tags[0]`) appended;
//   * a de-selected signifier that IS on the line has ALL of its tags
//     stripped;
//   * everything else (other tags, the task text) is left untouched.
// Idempotent — re-running with the same selection returns the same line.
export function computeSignifierLineEdit(
  line: string,
  signifiers: readonly Signifier[],
  selectedIds: readonly string[]
): string {
  const selected = new Set(selectedIds)
  const present = new Set(
    matchSignifiers(extractTags(line), signifiers).map((s) => s.id)
  )

  // Strip the tags of signifiers that are present but no longer selected.
  const tagsToStrip = signifiers
    .filter((s) => present.has(s.id) && !selected.has(s.id))
    .flatMap((s) => s.tags)
  let out = stripTags(line, tagsToStrip)

  // Append the primary tag of signifiers selected but not yet present.
  const toAdd = signifiers.filter(
    (s) => selected.has(s.id) && !present.has(s.id)
  )
  for (const signifier of toAdd) {
    const primary = signifier.tags[0]
    if (!primary) continue
    out = appendTag(out, primary)
  }
  return out
}

function appendTag(line: string, name: string): string {
  const trimmed = line.replace(/\s+$/, '')
  return trimmed.length ? `${trimmed} #${name}` : `#${name}`
}
