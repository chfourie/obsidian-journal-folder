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

import { type App, TFile, TFolder } from 'obsidian'
import { moment } from './moment'
import type { JournalFolderSettings } from './journal-folder-settings.type'
import {
  isJournalFileBasename,
  type JournalNote,
  journalNoteFactoryWithSettings,
  type JournalTimeUnit,
} from './journal-note'

// Templates are stored as plain notes with **standardized filenames** (not
// user-configured — see the design discussion in docs/auto-template.md). The
// plugin looks these up by tier inside the configured template folder and the
// per-folder override folder.
export const TEMPLATE_FILENAMES: Record<JournalTimeUnit, string> = {
  day: 'daily-template',
  week: 'weekly-template',
  month: 'monthly-template',
  quarter: 'quarterly-template',
  year: 'yearly-template',
}

// Cross-tier fallback note used when a tier has no dedicated template file.
export const DEFAULT_TEMPLATE_FILENAME = 'default-template'

// moment file patterns per tier — mirror the `filePattern` fields on the
// journal-note strategies. Used to synthesise the *current* period's basename
// when a template note is previewed (so editing `monthly.md` renders as this
// month's note).
const FILE_PATTERN_BY_TIER: Record<JournalTimeUnit, string> = {
  day: 'YYYY-MM-DD',
  week: 'gggg-[W]ww',
  month: 'YYYY-MM',
  quarter: 'YYYY-[Q]Q',
  year: 'YYYY',
}

// Lower-cased standardized basename → tier, for the five per-tier files.
const TIER_BY_FILENAME: Record<string, JournalTimeUnit> = {
  'daily-template': 'day',
  'weekly-template': 'week',
  'monthly-template': 'month',
  'quarterly-template': 'quarter',
  'yearly-template': 'year',
}

// True when `basename` is one of the standardized template names (case
// insensitive) — the five tier names or `default`.
export function isTemplateBasename(basename: string): boolean {
  const b = basename.toLowerCase()
  return b === DEFAULT_TEMPLATE_FILENAME || b in TIER_BY_FILENAME
}

// The tier a template note should *preview* as. The five tier files map to
// their own tier; `default.md` previews as a daily note (the most common
// case) so it still gets a live header/calendar. Non-template names → null.
export function templatePreviewTier(basename: string): JournalTimeUnit | null {
  const b = basename.toLowerCase()
  if (b in TIER_BY_FILENAME) return TIER_BY_FILENAME[b]
  if (b === DEFAULT_TEMPLATE_FILENAME) return 'day'
  return null
}

function parentPathOf(filePath: string): string {
  const i = filePath.lastIndexOf('/')
  return i === -1 ? '' : filePath.slice(0, i)
}

function basenameOf(filePath: string): string {
  const name = filePath.slice(filePath.lastIndexOf('/') + 1)
  return name.replace(/\.md$/i, '')
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '')
}

// Joins a journal folder path with the relative override folder name,
// handling the vault-root cases (`''` / `'/'`).
export function overrideFolderPath(
  journalFolderPath: string,
  overrideName: string
): string {
  const base = trimSlashes(journalFolderPath)
  return base ? `${base}/${overrideName}` : overrideName
}

// Classifies a file path: if it's a standardized template note living in the
// global template folder OR in any journal folder's override subfolder,
// returns the tier it should preview as; otherwise null. Pure — the caller
// supplies the known journal folder paths.
export function templateFileTier(opts: {
  filePath: string
  globalTemplateFolder: string
  overrideName: string
  journalFolderPaths: string[]
}): JournalTimeUnit | null {
  const { filePath, globalTemplateFolder, overrideName, journalFolderPaths } =
    opts
  const tier = templatePreviewTier(basenameOf(filePath))
  if (tier === null) return null

  const parent = trimSlashes(parentPathOf(filePath))
  const global = trimSlashes(globalTemplateFolder)
  if (global && parent === global) return tier

  for (const jf of journalFolderPaths) {
    if (parent === trimSlashes(overrideFolderPath(jf, overrideName))) return tier
  }
  return null
}

// Ordered candidate template-file paths for seeding a new note of `tier` in
// `journalFolderPath`. The per-folder override files come first, then the
// global ones. The legacy `journal-folder.md` body is interleaved by the
// caller (it isn't a file path) between these two groups.
export function templateCandidatePaths(opts: {
  journalFolderPath: string
  overrideName: string
  globalTemplateFolder: string
  tier: JournalTimeUnit
}): { override: string[]; globalPaths: string[] } {
  const { journalFolderPath, overrideName, globalTemplateFolder, tier } = opts
  const tierFile = `${TEMPLATE_FILENAMES[tier]}.md`
  const defaultFile = `${DEFAULT_TEMPLATE_FILENAME}.md`
  const overrideDir = overrideFolderPath(journalFolderPath, overrideName)
  const globalDir = trimSlashes(globalTemplateFolder)
  return {
    override: [`${overrideDir}/${tierFile}`, `${overrideDir}/${defaultFile}`],
    globalPaths: globalDir
      ? [`${globalDir}/${tierFile}`, `${globalDir}/${defaultFile}`]
      : [],
  }
}

// Picks the first candidate whose (trimmed) content is non-empty, else the
// built-in fallback. `null` candidates are missing files.
export function firstNonEmptyTemplate(
  candidates: Array<string | null>,
  fallback: string
): string {
  for (const c of candidates) {
    if (c !== null && c.trim().length > 0) return c
  }
  return fallback
}

// Today's basename for a tier, formatted with that tier's file pattern.
export function currentPeriodBasename(tier: JournalTimeUnit): string {
  return moment().format(FILE_PATTERN_BY_TIER[tier])
}

// Builds a synthetic `JournalNote` for the *current* period of `tier`,
// anchored in `folder`, so a template note can be previewed as if it were
// the live journal entry of that tier. Returns null when the folder is
// missing or the synthesised basename doesn't parse (e.g. a quarterly
// template while quarters are disabled). Mirrors the sidebar's duck-typed
// `TFile` approach — Obsidian's real TFile constructor can't take a
// post-hoc path.
export function buildTemplatePreviewNote(
  app: App,
  settings: JournalFolderSettings,
  tier: JournalTimeUnit,
  folder: TFolder
): JournalNote | null {
  const basename = currentPeriodBasename(tier)
  if (!isJournalFileBasename(basename, !!settings.quartersEnabled)) return null
  // A duck-typed synthetic TFile is intentional: `new TFile()` wires `path`
  // through an internal `setPath` that crashes on post-construction assignment,
  // and this template-preview note never exists on disk, so `instanceof TFile`
  // can't apply.
  const synthetic = {
    basename,
    name: `${basename}.md`,
    path: `${folder.path}/${basename}.md`,
    extension: 'md',
    parent: folder,
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- see comment above
  } as unknown as TFile
  try {
    return journalNoteFactoryWithSettings(settings)(synthetic)
  } catch {
    return null
  }
}
