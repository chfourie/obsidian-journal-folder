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

import {
  type JournalFolderSettings,
  type SignifierPlacement,
  matchSignifiers,
} from '../../data-access'
import { renderSignifierIcon } from './render-signifier-icon'

// Both placement modes (`margin` / `margin-column`) are absolutely-positioned
// left-margin gutters and share the `jf-signifier-gutter` base class (see
// styles.css). The single-column variant additionally carries
// `jf-signifier-column` (see `COLUMN_CLASS`) and a `--jf-sig-depth` custom
// property so CSS can pull it back out of its nesting indentation into one
// shared column.
const MARKER_CLASS = 'jf-signifier-gutter'

// Modifier class for the single-column gutter variant.
const COLUMN_CLASS = 'jf-signifier-column'

// Block-level elements a tag can sit inside. The signifier marker is
// anchored to the nearest of these so the icon leads the entry (the way a
// signifier leads an entry in a bullet journal) rather than appearing next
// to the tag wherever it happens to be in the text.
const BLOCK_SELECTOR = 'li, p, blockquote, h1, h2, h3, h4, h5, h6'

// Reading-view post-processor: for every tag bound to a configured
// signifier, render the signifier's icon in a left-margin gutter just left
// of the entry (the marker is absolutely positioned and placed by
// measurement — see `gutter-positioner.ts`). When
// `signifierHideTagInReadingView` is on the tag text itself is hidden.
// Idempotent — anchors are stamped `data-jf-signifier` and each entry holds
// at most one icon per signifier id. Signifiers apply to ALL rendered
// markdown, not just task / bullet lines.
export function processSignifiers(
  el: HTMLElement,
  settings: JournalFolderSettings
): void {
  const signifiers = settings.signifiers
  if (!signifiers || signifiers.length === 0) return

  const anchors = Array.from(el.querySelectorAll<HTMLAnchorElement>('a.tag'))
  for (const anchor of anchors) {
    if (anchor.dataset.jfSignifier) continue
    const tagName = tagNameOf(anchor)
    if (!tagName) continue
    const matched = matchSignifiers([tagName], signifiers)
    if (matched.length === 0) continue

    anchor.dataset.jfSignifier = '1'
    const block = lineSegmentFor(anchor, blockAncestor(anchor, el))
    const marker = ensureMarker(block, settings.signifierPlacement)
    for (const signifier of matched) {
      if (marker.querySelector(`[data-sig-id="${cssEscape(signifier.id)}"]`)) {
        continue
      }
      const icon = document.createElement('span')
      icon.className = 'jf-signifier'
      icon.dataset.sigId = signifier.id
      icon.setAttribute('aria-label', signifier.label)
      renderSignifierIcon(icon, signifier.icon)
      marker.appendChild(icon)
    }
    if (settings.signifierHideTagInReadingView) {
      anchor.classList.add('jf-signifier-hidden-tag')
    }
  }
}

// The block the signifier marker attaches to. Prefer the list item (`li`)
// when the tag is in a list, because that's where the bullet / checkbox
// lives — so `start` lands before the marker (true line start, matching the
// editing view) rather than inside an inner `<p>`. Falls back to the
// nearest paragraph / heading, then `el`.
function blockAncestor(anchor: HTMLElement, el: HTMLElement): HTMLElement {
  const li = anchor.closest<HTMLElement>('li')
  if (li && el.contains(li)) return li
  const block = anchor.closest<HTMLElement>(BLOCK_SELECTOR)
  return block && el.contains(block) ? block : el
}

// When a paragraph / heading carries soft line breaks (Obsidian's *Strict
// line breaks* off — the default), every visual line lives in ONE `<p>`
// separated by `<br>`s. Each line is its own logical entry, but they share a
// block — so without this, every line's signifier would clump into a single
// marker at the paragraph's start (start / margin) or end (end). We wrap the
// run of nodes making up the anchor's line in a `.jf-signifier-line` span and
// treat THAT as the entry, so each line gets its own marker on its own line.
//
// Scoped to paragraphs / headings: list items already separate entries into
// their own `<li>`, and a soft break inside an `<li>` is a continuation of
// that one entry, not a new one — so list items are returned unchanged. Blocks
// with no `<br>` (the common path) are also returned unchanged.
function lineSegmentFor(anchor: HTMLElement, block: HTMLElement): HTMLElement {
  // Another tag on the same line wrapped it already — share that segment.
  const existing = anchor.closest<HTMLElement>('.jf-signifier-line')
  if (existing && block.contains(existing)) return existing
  if (block.tagName === 'LI') return block

  const children = Array.from(block.childNodes)
  if (!children.some((n) => n.nodeName === 'BR')) return block

  // The direct child of `block` that contains (or is) the anchor.
  let topChild: HTMLElement = anchor
  while (topChild.parentElement && topChild.parentElement !== block) {
    topChild = topChild.parentElement
  }
  const idx = children.indexOf(topChild)
  if (idx === -1) return block

  // Grow the segment outward to the nearest `<br>` on each side.
  let start = idx
  while (start > 0 && children[start - 1].nodeName !== 'BR') start--
  let end = idx
  while (end < children.length - 1 && children[end + 1].nodeName !== 'BR') end++

  const span = document.createElement('span')
  span.className = 'jf-signifier-line'
  block.insertBefore(span, children[start])
  for (let i = start; i <= end; i++) span.appendChild(children[i])
  return span
}

// The element that actually holds an entry's inline content. Obsidian
// wraps list-item content (checkbox + text) in a `<p>` for "loose" list
// items; markers must go INSIDE that `<p>` or they land on their own line
// above the text. Tight items / paragraphs / headings host content
// directly.
function contentHost(block: HTMLElement): HTMLElement {
  if (block.tagName === 'LI') {
    const p = block.querySelector<HTMLElement>(':scope > p')
    if (p) return p
  }
  return block
}

// Finds an existing marker that belongs to THIS entry (not a nested list
// item's marker), so multiple tags on one line share one container.
function findOwnMarker(block: HTMLElement, cls: string): HTMLElement | null {
  const isLi = block.tagName === 'LI'
  for (const el of Array.from(block.querySelectorAll<HTMLElement>(`.${cls}`))) {
    if (!isLi || el.closest('li') === block) return el
  }
  return null
}

// Gets (or creates) the single marker container for an entry. Both placement
// modes are left-margin gutters: the marker is prepended into the entry's
// content host (which becomes the positioning context) and CSS positions it
// absolutely just left of the host, vertically centred on the line.
function ensureMarker(
  block: HTMLElement,
  placement: SignifierPlacement
): HTMLElement {
  const existing = findOwnMarker(block, MARKER_CLASS)
  if (existing) return existing

  const marker = document.createElement('span')
  marker.className = MARKER_CLASS
  if (placement === 'margin-column') {
    marker.classList.add(COLUMN_CLASS)
    // Stamp the entry's list-nesting depth so CSS can offset the marker back
    // out of its indentation into one shared column. Width-independent — the
    // per-level indent step is measured once and supplied as a CSS variable.
    marker.style.setProperty('--jf-sig-depth', String(listDepth(block)))
  }
  placeMarker(block, marker)
  return marker
}

// Number of ancestor lists (`<ul>` / `<ol>`) above this entry's block — its
// nesting depth, 0 for a top-level list item or a non-list block. Used by the
// single-column gutter to undo the entry's indentation. Pure (no layout
// reads) so it is unit-testable.
export function listDepth(block: HTMLElement): number {
  let depth = 0
  let node: HTMLElement | null = block.parentElement
  while (node) {
    const tag = node.tagName
    if (tag === 'UL' || tag === 'OL') depth++
    node = node.parentElement
  }
  return depth
}

function placeMarker(block: HTMLElement, marker: HTMLElement): void {
  // Make the entry's content host the positioning context (deterministic
  // regardless of Obsidian's indentation-guide `li { position: relative }`),
  // then CSS hangs the absolutely-positioned marker just left of it,
  // vertically centred on the line. Insertion slot is irrelevant — the
  // marker is taken out of flow by `position: absolute`.
  const host = contentHost(block)
  host.classList.add('jf-signifier-host')
  host.prepend(marker)
}

// Derives the bare, lowercased tag name from a tag anchor — preferring the
// `href` (`#important` → `important`), falling back to the text content.
function tagNameOf(anchor: HTMLAnchorElement): string {
  const href = anchor.getAttribute('href') ?? anchor.textContent ?? ''
  return href.replace(/^#/, '').trim().toLowerCase()
}

// Minimal CSS.escape fallback for the attribute selector (signifier ids are
// kebab slugs, but guard anyway). Avoids depending on `CSS.escape` under
// jsdom.
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}
