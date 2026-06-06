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

import { type App, TFolder } from 'obsidian'
import type { JournalFolderSettings } from '../../data-access'

// One legacy inline template field → one template note to write.
export type TemplateWrite = { filename: string; content: string }

// Maps the legacy inline template settings to the template notes that should
// be written into the global template folder. In per-tier mode each non-empty
// `*NoteAutoTemplateContent` field becomes its standardized tier file;
// otherwise the single `autoTemplateContent` becomes `default-template.md`. Empty
// fields are skipped. Pure so it can be unit-tested without a vault.
//
// Note: migration is keyed off *content presence*, not `autoTemplateEnabled`
// — a user who authored templates but currently has auto-fill off keeps them,
// so toggling it back on later still works.
export function collectMigrationWrites(
  settings: JournalFolderSettings
): TemplateWrite[] {
  const out: TemplateWrite[] = []
  const push = (filename: string, content: string) => {
    if (content && content.trim().length > 0) out.push({ filename, content })
  }
  if (settings.autoTemplatePerTier) {
    push('daily-template.md', settings.dailyNoteAutoTemplateContent)
    push('weekly-template.md', settings.weeklyNoteAutoTemplateContent)
    push('monthly-template.md', settings.monthlyNoteAutoTemplateContent)
    push('quarterly-template.md', settings.quarterlyNoteAutoTemplateContent)
    push('yearly-template.md', settings.yearlyNoteAutoTemplateContent)
  } else {
    push('default-template.md', settings.autoTemplateContent)
  }
  return out
}

// Creates every missing folder along `path` (Obsidian's `createFolder` only
// makes a single leaf and needs its parent to exist). Bails silently if a
// non-folder occupies a segment.
export async function ensureFolderExists(
  app: App,
  path: string
): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  let cur = ''
  for (const part of parts) {
    cur = cur ? `${cur}/${part}` : part
    const existing = app.vault.getAbstractFileByPath(cur)
    if (existing instanceof TFolder) continue
    if (existing) return
    try {
      await app.vault.createFolder(cur)
    } catch {
      // Another agent (or a create-race) already made it — fine.
    }
  }
}

// Writes the legacy inline templates into notes under `templateFolder`,
// never clobbering an existing file. Returns how many notes were written.
// Best-effort: individual write failures are swallowed so one bad path can't
// abort the whole migration (the flag is still set by the caller).
export async function runInlineTemplateMigration(
  app: App,
  settings: JournalFolderSettings
): Promise<number> {
  const writes = collectMigrationWrites(settings)
  if (writes.length === 0) return 0

  const dir = settings.templateFolder.replace(/\/+$/, '')
  if (!dir) return 0
  await ensureFolderExists(app, dir)

  let written = 0
  for (const { filename, content } of writes) {
    const path = `${dir}/${filename}`
    if (app.vault.getAbstractFileByPath(path)) continue
    try {
      await app.vault.create(path, content)
      written++
    } catch {
      // Swallow — keep migrating the rest.
    }
  }
  return written
}
