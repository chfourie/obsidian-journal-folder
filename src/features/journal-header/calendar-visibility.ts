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

import { writable } from 'svelte/store'

// In-memory only — resets when Obsidian restarts. Shared across every
// journal-header instance so toggling in one header propagates to all.
export const calendarVisible = writable(false)

// Once the user has explicitly toggled, the configured per-folder/global
// default no longer overrides their choice for the remainder of the session.
let userHasToggled = false

export function toggleCalendar(): void {
  userHasToggled = true
  calendarVisible.update((v) => !v)
}

export function applyCalendarDefault(value: boolean): void {
  if (userHasToggled) return
  calendarVisible.set(value)
}

export function __resetCalendarVisibilityForTests(): void {
  userHasToggled = false
  calendarVisible.set(false)
}
