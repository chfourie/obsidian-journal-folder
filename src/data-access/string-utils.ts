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

export function camelCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .split(/[ _-]/)
    .reduce((s, c) => s + c.charAt(0).toUpperCase() + c.slice(1))
}

// Inverse of `camelCase` for the camelCase → kebab-case direction. Used
// when writing per-folder overrides to YAML front matter, where the
// convention across the plugin is kebab-cased keys (`daily-note-title-
// pattern`) rather than the camelCase JS identifiers
// (`dailyNoteTitlePattern`). Matches the resolver's `camelCase` round-trip.
export function kebabCase(camelStr: string): string {
  return camelStr.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
}
