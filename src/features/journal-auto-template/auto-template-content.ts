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

// Built-in fallback used when neither the global setting nor the
// per-folder `journal-folder.md` body provides a template. The leading
// `%% JOURNAL NOTE %%` is an Obsidian hidden-comment line — it doesn't
// render but parks the cursor above the code block when the user toggles
// into edit mode (without it, the cursor lands inside the fence and the
// block stops rendering).
export const DEFAULT_AUTO_TEMPLATE =
  '%% JOURNAL NOTE %%\n```journal-header\n```\n'

// Strips a leading YAML front-matter block. Recognises both `---\n...\n---`
// and the rare `---\r\n...\r\n---` line-ending variants. Anything else is
// returned verbatim.
export function stripFrontMatter(source: string): string {
  const match = source.match(/^---\r?\n(?:[\s\S]*?\r?\n)?---\r?\n?/)
  return match ? source.slice(match[0].length) : source
}

// Front-matter and embedded-config values may arrive as real booleans (YAML)
// or as strings (`key: value` lines). Mirror the convention used elsewhere in
// the plugin: only the literal string "false" is falsy on the string path.
export function isTruthySetting(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().toLowerCase() !== 'false'
  return Boolean(value)
}
