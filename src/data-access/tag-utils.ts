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

import type { Signifier, TaskCategory } from './signifier.type'

// Matches an Obsidian inline tag: a `#` preceded by start-of-string or
// whitespace, then one or more tag characters (letters, digits, `_`, `-`,
// and `/` for nested tags). The leading boundary keeps `#` inside words
// (`foo#bar`) and Markdown headings (`# Heading`, where a space follows
// the `#`) from being read as tags.
const TAG_REGEX = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu

// Extracts the tag names (without `#`) from a line of text, lowercased and
// de-duplicated in first-seen order. Pure — exported for matching and for
// the reading-view / task-list pipelines.
export function extractTags(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(TAG_REGEX)) {
    const name = match[1].toLowerCase()
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

// True when `tag` equals `configured` or is a descendant of it — so the
// configured tag `important` matches both `#important` and the nested
// `#important/work`. Both inputs are compared case-insensitively.
function tagMatches(tag: string, configured: string): boolean {
  const a = tag.toLowerCase()
  const b = configured.toLowerCase()
  return a === b || a.startsWith(b + '/')
}

// Generic matcher: returns the configured items (preserving their config
// order) that bind at least one tag present on the line. Shared by the
// signifier and category matchers below.
function matchByTags<T extends { tags: string[] }>(
  tags: string[],
  items: readonly T[]
): T[] {
  return items.filter((item) =>
    item.tags.some((configured) =>
      tags.some((tag) => tagMatches(tag, configured))
    )
  )
}

// Returns the signifiers (in configuration order) whose tags appear among
// `tags`. A line can match several signifiers.
export function matchSignifiers(
  tags: string[],
  signifiers: readonly Signifier[]
): Signifier[] {
  return matchByTags(tags, signifiers)
}

// Returns the categories (in configuration order) whose tags appear among
// `tags`. A task can match several categories — it is then listed under
// each (see `group-tasks-by-category`).
export function matchCategories(
  tags: string[],
  categories: readonly TaskCategory[]
): TaskCategory[] {
  return matchByTags(tags, categories)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Removes only the listed tags (and any descendants of them) from `text`,
// leaving every other tag untouched, then tidies the whitespace the
// removal leaves behind. Used so signifier / category tags don't surface
// as raw `#important` text in the plugin's own task lists. `tagNames` are
// bare names (no `#`).
export function stripTags(text: string, tagNames: string[]): string {
  let out = text
  for (const name of tagNames) {
    if (!name) continue
    // `#name` optionally followed by `/nested/segments`, as a standalone
    // token (whitespace boundary), case-insensitive.
    const pattern = new RegExp(
      `(^|\\s)#${escapeRegExp(name)}(/[\\p{L}\\p{N}_/-]+)?(?=\\s|$)`,
      'giu'
    )
    out = out.replace(pattern, (_full, lead) => (lead === '' ? '' : ' '))
  }
  // Collapse the runs of whitespace the removals may have produced.
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\s+$/, '')
}
