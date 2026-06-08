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

// Horizontal positioning for the two margin (gutter) signifier placements.
//
// WHY MEASURE INSTEAD OF HARDCODING CSS: the bullet / checkbox column width
// and the per-nesting indentation are theme- and font-dependent, so any fixed
// CSS offset breaks under some theme or snippet. Instead we MEASURE the live
// layout and write each marker's `left`.
//
// WHY IT'S CHEAP: a marker's `left = targetX − hostLeft`, and both `targetX`
// and `hostLeft` are page coordinates of elements inside the same positioned /
// scrolling container — so they move together. The offset is therefore
// invariant to scroll and to window re-centering of a readable-width block. It
// only changes when intrinsic layout metrics change (theme, font size, the DOM
// itself). So we never recompute on scroll; we recompute on render, on theme
// change, and — for the single column only, whose offset includes the possibly
// width-relative indentation — on resize.
//
// WHY IT DOESN'T THRASH: every pass does ALL `getBoundingClientRect` reads
// first, then ALL style writes, inside one `requestAnimationFrame` — at most
// one forced reflow per pass. Reading view virtualizes sections, so the number
// of markers in the DOM is bounded by the viewport, not the document length.

import type { SignifierPlacement } from '../../data-access'

// Gap (px) kept between a per-row gutter icon and the entry's bullet/checkbox.
// ~1.5 character widths at the default font (a "ch" ≈ 8px). Tune here for more
// / less air.
export const ROW_GAP_PX = 12
// How far (px) the single column sits left of the leftmost entry's start.
export const COLUMN_INSET_PX = 8

// --- Pure geometry (unit-tested) -----------------------------------------

// `left` for a per-row gutter marker so its right edge (the marker is
// `translateX(-100%)` in CSS, i.e. shifted left by its own width) lands
// `ROW_GAP_PX` left of the entry's bullet/checkbox.
export function computeRowLeft(
  hostLeft: number,
  rowStartLeft: number,
  gap: number = ROW_GAP_PX
): number {
  return rowStartLeft - hostLeft - gap
}

// `left` for a single-column gutter marker so its left edge lands at the
// shared `columnX` (no CSS transform on the column variant).
export function computeColumnLeft(hostLeft: number, columnX: number): number {
  return columnX - hostLeft
}

// The shared x for the single column: just left of the leftmost entry start
// across all column markers. `null` when there is nothing to anchor to.
export function columnAnchorX(
  rowStarts: number[],
  inset: number = COLUMN_INSET_PX
): number | null {
  if (rowStarts.length === 0) return null
  return Math.min(...rowStarts) - inset
}

// How much left lane to reserve given the leftmost icon's natural (un-reserved)
// viewport x and the pane's clip edge: only the DEFICIT by which the icon would
// clip past the edge, never a fixed lane. 0 when the existing margin already
// fits the icons (e.g. readable line width on). Pure / unit-tested.
export function computeReserve(naturalIconLeft: number, clipLeft: number): number {
  return Math.max(0, clipLeft - naturalIconLeft)
}

// Small breathing room kept between the leftmost icon and the pane's edge.
export const EDGE_MARGIN_PX = 4

// Upper bound on the reserved lane, given the widest icon-stack marker. The
// icon hangs at most its own width plus the per-row gap and the column inset
// left of the entry, so the lane can NEVER legitimately need more than this.
// A transient mis-measurement during resize that computes a huge deficit must
// not push the note content off screen — clamping the deficit to this intrinsic
// bound (marker width + constants, independent of the corrupted pane geometry)
// keeps the layout recoverable. Pure / unit-tested.
export function maxGutterReserve(maxMarkerWidth: number): number {
  return maxMarkerWidth + ROW_GAP_PX + COLUMN_INSET_PX + EDGE_MARGIN_PX
}

// --- Reading-view DOM pass ------------------------------------------------

interface GutterRead {
  marker: HTMLElement
  hostLeft: number
  rowStartLeft: number
  width: number
  topOffset: number
}

// The host's top padding (px). The gutter marker is absolutely positioned with
// `top:0`, which resolves to the host's PADDING-box top. On a block whose theme
// / Obsidian core pads the top — most visibly headings (Obsidian gives heading
// lines `padding-top: var(--p-spacing)` in the editor, ~16px; some themes pad
// headings in reading view too) — `top:0` lands ABOVE the first glyph, in the
// padding strip, so the centred-in-`1lh` icon floats above the text. We measure
// that padding and push the marker down by it (written as inline `top`) so
// `height:1lh; align-items:center` centres on the actual text line. 0 for
// unpadded blocks (the common case), so this is inert wherever it already
// aligned. Measured here in the READ phase to preserve the single-reflow pass.
function hostPaddingTop(host: HTMLElement): number {
  return parseFloat(getComputedStyle(host).paddingTop) || 0
}

// The container's own CSS padding-inline-start (px), cached the first time we
// touch it (before we ever override it inline) so the reserved lane is always
// ADDED to the theme's base padding and never compounds across recomputes.
const reserveBase = new WeakMap<HTMLElement, number>()

function reserveBaseFor(container: HTMLElement): number {
  let base = reserveBase.get(container)
  if (base === undefined) {
    base = parseFloat(getComputedStyle(container).paddingInlineStart) || 0
    reserveBase.set(container, base)
  }
  return base
}

// Restore every reading container's padding (drop our inline override) — used
// when the placement leaves the margin modes. The cached base stays valid.
export function clearAllReadingReserve(): void {
  for (const sizer of Array.from(
    activeDocument.querySelectorAll<HTMLElement>('.markdown-preview-sizer')
  )) {
    sizer.style.removeProperty('padding-inline-start')
  }
}

// The horizontal clip boundary for a reading note's gutter: the left content
// edge of the nearest ancestor that actually clips horizontal overflow
// (overflow-x auto/scroll/hidden/clip). That's where icons get cut off — NOT
// the centered `.markdown-preview-sizer` (overflow visible), whose left edge
// sits far to the right of the clip. Robust to class drift; padding we add to
// the sizer never moves these ancestors, so it's a stable reference.
function readingClipLeft(container: HTMLElement): number {
  let el: HTMLElement | null = container
  while (el) {
    const ox = getComputedStyle(el).overflowX
    if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
      return el.getBoundingClientRect().left + el.clientLeft
    }
    el = el.parentElement
  }
  return container.getBoundingClientRect().left
}

// Candidates for an entry's visible line-start: a list bullet, a task
// checkbox, or the plugin's rendered task-status circle.
const ROW_START_SELECTOR =
  'input.task-list-item-checkbox, .jf-task-status, .list-bullet'

// A bullet / checkbox sits at most this far (px) left of its entry's content.
// Some task rows carry a stray empty `.list-bullet` parked hundreds of px to
// the left (observed at -680px via the CLI); anything beyond this is bogus and
// would fling the icon off-screen, so it's ignored.
const MAX_ROW_START_REACH_PX = 100

// The left edge of an entry's bullet / checkbox / status (where the icon
// should hang just left of), falling back to the content host's own left for
// non-list blocks (paragraphs, headings).
//
// Scoped to THIS list item (not nested children) and ignores zero-area boxes:
// a task row carries an EMPTY `.list-bullet` (the bullet is replaced by the
// checkbox) whose `getBoundingClientRect()` is `{left: 0, …}` — using it would
// fling the icon ~one readable-width off-screen and, via the column's `min()`,
// drag the whole column with it.
function rowStartLeftOf(host: HTMLElement, hostLeft: number): number {
  const li = host.closest('li')
  if (!li) return hostLeft
  const lefts: number[] = []
  for (const el of Array.from(
    li.querySelectorAll<HTMLElement>(ROW_START_SELECTOR)
  )) {
    if (el.closest('li') !== li) continue // belongs to a nested item
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue // not rendered
    if (rect.left < hostLeft - MAX_ROW_START_REACH_PX) continue // bogus / parked
    lefts.push(rect.left)
  }
  return lefts.length ? Math.min(...lefts) : hostLeft
}

// Position every `.jf-signifier-gutter` inside `container` for the active
// margin mode. READS all rects, THEN writes all `left`s (one reflow). Call
// inside a `requestAnimationFrame`.
export function positionReadingGutters(
  container: HTMLElement,
  placement: SignifierPlacement,
  reserveGutter: boolean
): void {
  if (placement !== 'margin' && placement !== 'margin-column') return
  const markers = Array.from(
    container.querySelectorAll<HTMLElement>('.jf-signifier-gutter')
  )
  if (markers.length === 0) return

  // READ phase — no writes here.
  const reads: GutterRead[] = markers.map((marker) => {
    const host =
      marker.closest<HTMLElement>('.jf-signifier-host') ??
      marker.parentElement ??
      marker
    const rect = marker.getBoundingClientRect()
    const hostLeft = host.getBoundingClientRect().left
    return {
      marker,
      hostLeft,
      rowStartLeft: rowStartLeftOf(host, hostLeft),
      width: rect.width,
      topOffset: hostPaddingTop(host),
    }
  })
  const columnX =
    placement === 'margin-column'
      ? columnAnchorX(reads.map((r) => r.rowStartLeft))
      : null
  const base = reserveBaseFor(container)

  // Compute each marker's host-relative `left` and the resulting viewport x of
  // its visible left edge (both modes shift the icon left of its box by its
  // own width via CSS `translateX(-100%)`). Track the leftmost.
  let minIconLeft = Infinity
  const placed = reads.map((r) => {
    const left =
      placement === 'margin-column' && columnX !== null
        ? computeColumnLeft(r.hostLeft, columnX)
        : computeRowLeft(r.hostLeft, r.rowStartLeft)
    const iconLeft = r.hostLeft + left - r.width
    if (iconLeft < minIconLeft) minIconLeft = iconLeft
    return { marker: r.marker, left, top: r.topOffset }
  })

  // Reserve only the deficit by which the leftmost icon would clip past the
  // pane's actual overflow edge (the nearest ancestor that clips horizontally
  // — NOT the centered sizer, whose left edge is far to the right of where
  // icons really clip; using it over-reserves and ragged-ifies the spacing).
  // Measured against the icon's natural (un-reserved) x so it can't oscillate.
  let shortfall = 0
  if (reserveGutter && minIconLeft !== Infinity) {
    const clipLeft = readingClipLeft(container) + EDGE_MARGIN_PX
    // How much WE are currently reserving, read from the live inline padding
    // (NOT a cached map, which desynced on navigate-back and silently zeroed
    // the deficit). Subtract it to recover the icon's natural x.
    const ourReserve = Math.max(
      0,
      (parseFloat(container.style.paddingInlineStart) || 0) - base
    )
    const naturalLeft = minIconLeft - ourReserve
    // Safety clamp (see `maxGutterReserve`): a transient mis-measurement during
    // resize must never push the content off screen (observed: an enormous lane
    // that emptied the pane).
    const maxMarkerWidth = reads.reduce((m, r) => Math.max(m, r.width), 0)
    shortfall = Math.min(
      computeReserve(naturalLeft, clipLeft),
      maxGutterReserve(maxMarkerWidth)
    )
  }

  // WRITE phase. The `left`s are host-relative deltas, so padding the container
  // (which shifts the host right) leaves them valid. Revealing here (the
  // `jf-positioned` class — CSS keeps markers hidden until then) avoids a
  // one-frame flash before the first measurement lands.
  for (const p of placed) {
    p.marker.style.left = `${p.left}px`
    // Push the marker down past any host top-padding so it centres on the text
    // line, not the padded box (see `hostPaddingTop`). Inert (`0`) when the host
    // is unpadded.
    p.marker.style.top = `${p.top}px`
    p.marker.classList.add('jf-positioned')
  }
  if (shortfall > 0) {
    container.style.paddingInlineStart = `${base + shortfall}px`
  } else {
    container.style.removeProperty('padding-inline-start')
  }
}

// --- Scheduling (debounced, one rAF) -------------------------------------

const pendingContainers = new Set<HTMLElement>()
let scheduledPlacement: SignifierPlacement = 'margin-column'
let scheduledReserve = false
let rafHandle = 0

// Coalesce positioning requests into a single animation frame. Multiple
// post-processor calls (one per rendered section) collapse to one reflow.
//
// Exactly ONE pass per frame — no confirmation / re-measure chain. A second
// deferred pass races the next frame's pass during a continuous resize (each
// reads a half-settled layout), which made the reserved lane oscillate and
// the content jerk. Settling after a resize is handled upstream by debouncing
// the resize trigger (see the feature's ResizeObserver) so the single pass
// runs once on the final, settled geometry.
export function scheduleReadingGutters(
  container: HTMLElement,
  placement: SignifierPlacement,
  reserveGutter: boolean
): void {
  if (placement !== 'margin' && placement !== 'margin-column') return
  pendingContainers.add(container)
  scheduledPlacement = placement
  scheduledReserve = reserveGutter
  if (rafHandle) return
  rafHandle = window.requestAnimationFrame(() => {
    rafHandle = 0
    const containers = [...pendingContainers]
    pendingContainers.clear()
    for (const c of containers) {
      if (c.isConnected) {
        positionReadingGutters(c, scheduledPlacement, scheduledReserve)
      }
    }
  })
}

// Reposition every currently-rendered reading-view note. Used on theme
// (`css-change`) and resize. Cheap: only on-screen `.markdown-preview-sizer`
// containers hold markers.
export function repositionAllReadingGutters(
  placement: SignifierPlacement,
  reserveGutter: boolean
): void {
  if (placement !== 'margin' && placement !== 'margin-column') return
  const sizers = activeDocument.querySelectorAll<HTMLElement>(
    '.markdown-preview-sizer'
  )
  for (const sizer of Array.from(sizers)) {
    scheduleReadingGutters(sizer, placement, reserveGutter)
  }
}
