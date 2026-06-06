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

// Helpers for the master menu's "switch light/dark" action. The action drives
// Obsidian's own Base color scheme (Settings → Appearance) via the runtime
// `app.changeTheme(value)` method — it is purely a shortcut to the standard
// setting, not a parallel theme system. `app.getTheme()` reports the *effective*
// scheme: it resolves the 'system' (Adapt to system) setting to whichever
// explicit scheme is currently showing, so the two values we ever see here are
// 'obsidian' (dark) and 'moonstone' (light).

export type ObsidianColorScheme = 'obsidian' | 'moonstone'

// Return the scheme to switch to, given the current effective scheme. A user on
// 'Adapt to system' is flipped to an explicit scheme and left there — we never
// try to be clever about returning to 'system' (the maintainer's choice). Any
// unexpected value defaults to switching to dark.
export function nextColorScheme(current: string): ObsidianColorScheme {
  return current === 'obsidian' ? 'moonstone' : 'obsidian'
}

// Menu rows in this plugin read as actions (verbs) — "Open … sidebar",
// "Initialise …" — so the theme row matches that voice ("Switch to light
// mode") rather than the current-state phrasing used for on/off toggles.
export function colorSchemeMenuLabel(current: string): string {
  return nextColorScheme(current) === 'moonstone'
    ? 'Switch to light mode'
    : 'Switch to dark mode'
}

// The icon depicts the destination scheme: a sun when the click switches to
// light, a moon when it switches to dark.
export function colorSchemeMenuIcon(current: string): string {
  return nextColorScheme(current) === 'moonstone' ? 'sun' : 'moon'
}
