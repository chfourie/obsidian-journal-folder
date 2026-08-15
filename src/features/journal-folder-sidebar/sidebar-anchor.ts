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
import { moment } from '../../data-access'
import {
  isJournalFileBasename,
  type JournalFolderSettings,
  type JournalNote,
  type JournalNoteSource,
  journalNoteFactoryWithSettings,
} from '../../data-access'

// Today's date formatted as a daily-note basename (`YYYY-MM-DD`). Used as
// the default anchor for the sidebar calendar when there's no active
// journal note to follow.
export function todayDailyBasename(): string {
  return moment().format('YYYY-MM-DD')
}

// Builds a `JournalNote` rooted in `folderPath` with the given anchor
// basename, suitable for driving the sidebar calendar. The anchor doesn't
// have to point at an *existing* file — `journalNoteFactoryWithSettings`
// only needs the parent folder + a parseable basename. Existence checks
// for individual cells happen via the folder's children list, which is
// always read live from `TFolder.children`.
//
// Returns `null` when the folder isn't loaded (`getAbstractFileByPath`
// misses) or when the basename doesn't match a recognised journal pattern
// — the calendar can't render in those cases.
export function buildAnchorNote(
  app: App,
  folderPath: string,
  anchorBasename: string,
  settings: JournalFolderSettings
): JournalNote | null {
  const folder = app.vault.getAbstractFileByPath(
    folderPath === '' || folderPath === '/' ? '/' : folderPath
  )
  if (!(folder instanceof TFolder)) return null
  if (
    !isJournalFileBasename(anchorBasename, !!settings.quartersEnabled)
  ) {
    return null
  }
  // `JournalNoteSource` is the structural slice the factory reads — the
  // anchor note never exists on disk, so there is no real `TFile` to pass.
  // We intentionally don't add the synthetic file to the folder's children,
  // because if it doesn't exist on disk we don't want it counted as an
  // "existing" note.
  const synthetic: JournalNoteSource = {
    basename: anchorBasename,
    parent: folder,
  }
  try {
    return journalNoteFactoryWithSettings(settings)(synthetic)
  } catch {
    // Strategy lookup throws when the regexes don't match — already gated
    // by `isJournalFileBasename` above, but defensive in case the two
    // ever drift apart.
    return null
  }
}
