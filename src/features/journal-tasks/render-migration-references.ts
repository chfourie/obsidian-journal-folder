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

import { setIcon } from 'obsidian'
import {
  type JournalFolderSettings,
  LUCIDE_MARKER_PREFIX,
} from '../../data-access'

// A migration reference is `<marker> [[link]]`. In reading view we want
// to (a) render a Lucide marker token as an icon, and (b) fade the whole
// reference (marker + link) down to a configured opacity, back to full on
// hover. This is the reading-view counterpart to what is written into the
// note by `task-migration.ts`.

// Finds a configured marker sitting at the end of `text` (ignoring
// trailing whitespace), as a standalone token (preceded by whitespace or
// the start of the node). Longer markers are matched first so a
// `lucide:…` token wins over a bare arrow. Returns the marker and its
// start index within `text`, or null when no marker trails the node.
export function matchTrailingMarker(
  text: string,
  markers: string[]
): { marker: string; index: number } | null {
  const trimmed = text.replace(/\s+$/, '')
  const candidates = markers
    .filter((m) => m.trim().length > 0)
    .sort((a, b) => b.length - a.length)
  for (const marker of candidates) {
    if (!trimmed.endsWith(marker)) continue
    const index = trimmed.length - marker.length
    if (index === 0 || /\s/.test(trimmed[index - 1])) {
      return { marker, index }
    }
  }
  return null
}

// Builds the inner marker node for the wrapper: a rendered Lucide icon
// for `lucide:<name>` tokens, otherwise a plain text node.
function appendMarker(wrapper: HTMLElement, marker: string): void {
  if (marker.startsWith(LUCIDE_MARKER_PREFIX)) {
    const name = marker.slice(LUCIDE_MARKER_PREFIX.length).trim()
    const icon = wrapper.createSpan({ cls: 'jf-migration-ref-icon' })
    setIcon(icon, name)
  } else {
    wrapper.appendChild(document.createTextNode(marker))
  }
}

// Scans a rendered element for migration references and rewrites each so
// the label text and the reference (marker + link) live inside a single
// `.jf-migration-line` element. This matters because task-list themes
// often render `li.task-list-item` as a CSS grid, which blockifies every
// direct child — a bare marker/link would be dropped onto its own row.
// Merging label + reference into one element keeps them in a single grid
// cell so they flow inline. The reference itself sits in a nested
// `.jf-migration-ref` span carrying the configured opacity (full on
// hover). No-op when both markers are empty (a bare link can't be told
// apart from an ordinary link).
export function processMigrationReferences(
  el: HTMLElement,
  settings: JournalFolderSettings
): void {
  const markers = [
    settings.taskMigrationToMarker,
    settings.taskMigrationFromMarker,
  ].filter((m) => m.trim().length > 0)
  if (markers.length === 0) return

  const opacity = Math.min(
    100,
    Math.max(0, settings.taskMigrationReferenceOpacity)
  )
  const links = Array.from(
    el.querySelectorAll<HTMLAnchorElement>('a.internal-link')
  )
  for (const link of links) {
    const prev = link.previousSibling
    if (!prev || prev.nodeType !== Node.TEXT_NODE) continue
    const text = prev.textContent ?? ''
    const match = matchTrailingMarker(text, markers)
    if (!match) continue

    const parent = link.parentNode
    if (!parent) continue

    // The dimmed reference: marker (icon or text) + space + the link.
    const ref = document.createElement('span')
    ref.className = 'jf-migration-ref'
    ref.style.setProperty('--jf-migration-ref-opacity', String(opacity / 100))
    appendMarker(ref, match.marker)
    ref.appendChild(document.createTextNode(' '))

    // Outer line wrapper holds the preceding label text + the reference
    // as ONE node, so a grid-based task row keeps them on the same line.
    const lineWrap = document.createElement('span')
    lineWrap.className = 'jf-migration-line'
    lineWrap.appendChild(document.createTextNode(text.slice(0, match.index)))
    lineWrap.appendChild(ref)

    parent.insertBefore(lineWrap, prev)
    ref.appendChild(link) // moves the link out of the row into the ref
    parent.removeChild(prev)
  }
}
