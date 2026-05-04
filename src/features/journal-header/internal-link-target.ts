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

// Walks up from an event target to the nearest `<a class="internal-link">`
// and returns its href. Used by the More popover, which is portaled to
// `document.body` to escape CodeMirror widget clipping — once outside the
// rendered markdown container, Obsidian's link interception no longer fires,
// so the popover handles internal-link clicks itself.
export function findInternalLinkHref(
  target: EventTarget | null
): string | null {
  if (!(target instanceof Element)) return null
  const anchor = target.closest('a.internal-link')
  if (!anchor) return null
  return anchor.getAttribute('href')
}
