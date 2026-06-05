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

// Wrapper class per placement mode. `start` / `end` render in normal flow;
// `margin` / `margin-column` are absolutely positioned (see styles.css).
// Both margin modes share the `jf-signifier-gutter` base class; the single-
// column variant additionally carries `jf-signifier-column` (see
// `COLUMN_CLASS`) and a `--jf-sig-depth` custom property so CSS can pull it
// back out of its nesting indentation into one shared column.
const MARKER_CLASS: Record<SignifierPlacement, string> = {
  start: 'jf-signifier-lead',
  end: 'jf-signifier-trail',
  margin: 'jf-signifier-gutter',
  'margin-column': 'jf-signifier-gutter',
}

// Modifier class for the single-column gutter variant.
const COLUMN_CLASS = 'jf-signifier-column'

// Block-level elements a tag can sit inside. The signifier marker is
// anchored to the nearest of these so the icon leads the entry (the way a
// signifier leads an entry in a bullet journal) rather than appearing next
// to the tag wherever it happens to be in the text.
const BLOCK_SELECTOR = 'li, p, blockquote, h1, h2, h3, h4, h5, h6'

// Reading-view post-processor: for every tag bound to a configured
// signifier, render the signifier's icon at the START of the entry, in
// normal flow. Flow placement (rather than absolute positioning) is
// deliberate — it can never overlap the bullet / checkbox and is immune to
// themes and CSS snippets that restyle list layout. When
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
    const block = blockAncestor(anchor, el)
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

// Gets (or creates) the single marker container for an entry, positioned
// per the placement mode:
//   start  — after the bullet / checkbox (and the plugin's task-status
//            icon), immediately before the entry text, INSIDE the content
//            host. Inline, so it never wraps and aligns at any nesting.
//   end    — at the end of the line's own text (inside the content host,
//            before any nested list), so it trails the line not the subtree.
//   margin — placed in flow like `start`, but CSS positions it absolutely
//            (`top: auto` keeps it on its line) anchored to the readable-
//            width container, so all icons form one left-margin column.
function ensureMarker(
  block: HTMLElement,
  placement: SignifierPlacement
): HTMLElement {
  const cls = MARKER_CLASS[placement]
  const existing = findOwnMarker(block, cls)
  if (existing) return existing

  const marker = document.createElement('span')
  marker.className = cls
  if (placement === 'margin-column') {
    marker.classList.add(COLUMN_CLASS)
    // Stamp the entry's list-nesting depth so CSS can offset the marker back
    // out of its indentation into one shared column. Width-independent — the
    // per-level indent step is measured once and supplied as a CSS variable.
    marker.style.setProperty('--jf-sig-depth', String(listDepth(block)))
  }
  placeMarker(block, marker, placement)
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

function placeMarker(
  block: HTMLElement,
  marker: HTMLElement,
  placement: SignifierPlacement
): void {
  const host = contentHost(block)

  if (placement === 'margin' || placement === 'margin-column') {
    // Make the entry's content host the positioning context (deterministic
    // regardless of Obsidian's indentation-guide `li { position: relative }`),
    // then CSS hangs the absolutely-positioned marker just left of it,
    // vertically centred on the line. Insertion slot is irrelevant — the
    // marker is taken out of flow by `position: absolute`.
    host.classList.add('jf-signifier-host')
    host.prepend(marker)
    return
  }

  if (placement === 'end') {
    if (host !== block) {
      host.append(marker)
      return
    }
    const nested = block.querySelector<HTMLElement>(':scope > ul, :scope > ol')
    if (nested) nested.before(marker)
    else block.append(marker)
    return
  }

  // start — after the checkbox + task-status icon when present, else after
  // the bullet, else at the start of the content host.
  const checkbox = block.querySelector<HTMLElement>(
    'input.task-list-item-checkbox'
  )
  if (checkbox) {
    let ref = checkbox
    const sib = checkbox.nextElementSibling
    if (sib instanceof HTMLElement && sib.classList.contains('jf-task-status')) {
      ref = sib
    }
    ref.after(marker)
    return
  }
  const bullet = host.querySelector<HTMLElement>(':scope > .list-bullet')
  if (bullet) bullet.after(marker)
  else host.prepend(marker)
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
