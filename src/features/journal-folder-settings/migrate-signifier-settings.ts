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

import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../../data-access'

// Earlier releases offered four signifier placements — two in-flow
// (`'start'` / `'end'`) and two margin gutters (`'margin'` /
// `'margin-column'`). The in-flow modes were removed (see commit
// "Signifiers: margin-only placement…"), leaving only the two gutters, but
// no migration was added. A vault that had persisted the old default
// `'start'` therefore carries an unknown value, and because the gutter
// positioner gates on the two valid values and bails on anything else, every
// signifier silently renders *nothing* (the marker is created but never
// positioned, so it stays `visibility:hidden`, and its tag is hidden too).
//
// Coerce any non-current `signifierPlacement` back to the default so such
// vaults self-heal on the next settings load.
export function migrateSignifierSettings(
  settings: JournalFolderSettings
): JournalFolderSettings {
  // Compared as a plain string: the persisted value may be a legacy member
  // (`'start'` / `'end'`) that is no longer part of the `SignifierPlacement`
  // union, so the type system can't see it as a possibility.
  const placement = settings.signifierPlacement as string
  if (placement === 'margin' || placement === 'margin-column') return settings
  return {
    ...settings,
    signifierPlacement: DEFAULT_SETTINGS.signifierPlacement,
  }
}
