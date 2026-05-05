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

import type { JournalFolderSettings } from 'src/data-access'

// Pick the platform-appropriate default-calendar-visibility from settings.
// The desktop and mobile defaults are independent fields so a user can
// suppress the calendar on phones without affecting desktop, which is the
// common case (mobile screens are too narrow for the multi-month layout to
// be useful by default).
export function resolveDefaultCalendarVisible(
  settings: JournalFolderSettings,
  isMobile: boolean
): boolean {
  return isTruthy(
    isMobile
      ? settings.defaultCalendarVisibleMobile
      : settings.defaultCalendarVisibleDesktop
  )
}

// Folder front-matter and embedded code-block configs are merged in by
// FolderSettingsResolver as raw values, so a boolean field can arrive as a
// real boolean (YAML), the string "true"/"false" (embedded `key: value`
// lines), or anything else a user typed. Treat the string "false" — and
// only that — as false; defer to JS truthiness for everything else.
function isTruthy(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().toLowerCase() !== 'false'
  return Boolean(value)
}
