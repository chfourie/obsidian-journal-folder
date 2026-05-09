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

// Resolves which template body to seed a new journal note with. Precedence
// (first non-empty wins):
//   1. Per-folder body of `journal-folder.md` (front-matter stripped).
//   2. Per-tier global template (`{daily,weekly,monthly,quarterly,yearly}NoteAutoTemplateContent`).
//   3. Generic global template (`autoTemplateContent`).
//   4. Built-in `DEFAULT_AUTO_TEMPLATE`.
// `perUnitTemplate` may be the empty string when the caller has no per-tier
// override to apply (or when the note's tier doesn't have a dedicated field).
export function resolveAutoTemplate(
  folderConfigBody: string | null,
  perUnitTemplate: string,
  globalTemplate: string
): string {
  if (folderConfigBody !== null) {
    const body = stripFrontMatter(folderConfigBody)
    if (body.trim().length > 0) return body
  }
  if (perUnitTemplate.trim().length > 0) return perUnitTemplate
  if (globalTemplate.trim().length > 0) return globalTemplate
  return DEFAULT_AUTO_TEMPLATE
}

// Picks the per-tier template field that matches a journal time unit. Used
// by the auto-template feature to thread the right setting into
// `resolveAutoTemplate`. Yearly unit returns `yearlyNoteAutoTemplateContent`,
// etc. A `null` unit (non-journal basename) returns the empty string so the
// resolver falls straight through to the generic global template.
export function perUnitAutoTemplate(
  settings: JournalAutoTemplateSettings,
  unit: 'day' | 'week' | 'month' | 'quarter' | 'year' | null
): string {
  switch (unit) {
    case 'day':
      return settings.dailyNoteAutoTemplateContent
    case 'week':
      return settings.weeklyNoteAutoTemplateContent
    case 'month':
      return settings.monthlyNoteAutoTemplateContent
    case 'quarter':
      return settings.quarterlyNoteAutoTemplateContent
    case 'year':
      return settings.yearlyNoteAutoTemplateContent
    default:
      return ''
  }
}

// Subset of `JournalFolderSettings` actually consulted by the resolver —
// kept narrow so the helper can be unit-tested without building a full
// settings object.
export type JournalAutoTemplateSettings = {
  dailyNoteAutoTemplateContent: string
  weeklyNoteAutoTemplateContent: string
  monthlyNoteAutoTemplateContent: string
  quarterlyNoteAutoTemplateContent: string
  yearlyNoteAutoTemplateContent: string
}

// Front-matter and embedded-config values may arrive as real booleans (YAML)
// or as strings (`key: value` lines). Mirror the convention used elsewhere in
// the plugin: only the literal string "false" is falsy on the string path.
export function isTruthySetting(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().toLowerCase() !== 'false'
  return Boolean(value)
}
