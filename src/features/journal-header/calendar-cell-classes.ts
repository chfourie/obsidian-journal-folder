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

import type { CalendarCell } from './journal-calendar-info'

// `is-unresolved` is added by the plugin (not delegated to Obsidian) because
// Obsidian's link-resolution pass only stamps internal-link cells that are
// present during the initial markdown render. The calendar progressively
// inserts months as the ResizeObserver settles, and arrow-scroll inserts new
// months on demand — both of which Obsidian's pass misses, leaving those
// cells without the theme's unresolved-link styling and visually inconsistent
// across months. Stamping the class ourselves from `cell.exists` keeps every
// month consistent regardless of insertion timing.
export function calendarCellClasses(cell: CalendarCell): string {
  const classes = ['journal-folder-calendar-cell']
  if (cell.isCurrent) classes.push('is-current')
  if (cell.isToday) classes.push('is-today')
  classes.push(cell.exists ? 'exists' : 'missing')
  if (!cell.exists) classes.push('is-unresolved')
  if (cell.needsConfirmation) classes.push('past-missing')
  return classes.join(' ')
}
