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

// The task-list heading label. The count is `totalBeforeCap` — the
// visible population *before* the size cap — so it agrees with the
// truncation footer's "Showing X of N" instead of restating the capped
// list length (which understated the real task count whenever the cap
// hit). With the completed filter on, the hidden-count suffix shows the
// filter is active even when it hides nothing.
export function taskListHeaderLabel(opts: {
  caption?: string
  showCompleted: boolean
  totalBeforeCap: number
  hiddenCompletedCount: number
}): string {
  const caption =
    opts.caption && opts.caption.trim() ? opts.caption : 'TASKS'
  if (opts.showCompleted) return `${caption} (${opts.totalBeforeCap})`
  return `${caption} (${opts.totalBeforeCap} · ${opts.hiddenCompletedCount} ✓ hidden)`
}
