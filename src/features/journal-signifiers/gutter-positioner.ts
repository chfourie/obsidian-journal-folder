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

// --- Reading-view DOM pass ------------------------------------------------

interface GutterRead {
  marker: HTMLElement
  hostLeft: number
  rowStartLeft: number
}

// Candidates for an entry's visible line-start: a list bullet, a task
// checkbox, or the plugin's rendered task-status circle.
const ROW_START_SELECTOR =
  'input.task-list-item-checkbox, .jf-task-status, .list-bullet'

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
    lefts.push(rect.left)
  }
  return lefts.length ? Math.min(...lefts) : hostLeft
}

// Position every `.jf-signifier-gutter` inside `container` for the active
// margin mode. READS all rects, THEN writes all `left`s (one reflow). Call
// inside a `requestAnimationFrame`.
export function positionReadingGutters(
  container: HTMLElement,
  placement: SignifierPlacement
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
    const hostLeft = host.getBoundingClientRect().left
    return { marker, hostLeft, rowStartLeft: rowStartLeftOf(host, hostLeft) }
  })
  const columnX =
    placement === 'margin-column'
      ? columnAnchorX(reads.map((r) => r.rowStartLeft))
      : null

  // WRITE phase. Revealing here (via the `jf-positioned` class — CSS keeps
  // gutter markers hidden until then) avoids a one-frame flash at the wrong
  // x before the first measurement lands.
  for (const r of reads) {
    const left =
      placement === 'margin-column' && columnX !== null
        ? computeColumnLeft(r.hostLeft, columnX)
        : computeRowLeft(r.hostLeft, r.rowStartLeft)
    r.marker.style.left = `${left}px`
    r.marker.classList.add('jf-positioned')
  }
}

// --- Scheduling (debounced, one rAF) -------------------------------------

const pendingContainers = new Set<HTMLElement>()
let scheduledPlacement: SignifierPlacement = 'start'
let rafHandle = 0

// Coalesce positioning requests into a single animation frame. Multiple
// post-processor calls (one per rendered section) collapse to one reflow.
export function scheduleReadingGutters(
  container: HTMLElement,
  placement: SignifierPlacement
): void {
  if (placement !== 'margin' && placement !== 'margin-column') return
  pendingContainers.add(container)
  scheduledPlacement = placement
  if (rafHandle) return
  rafHandle = requestAnimationFrame(() => {
    rafHandle = 0
    const containers = [...pendingContainers]
    pendingContainers.clear()
    for (const c of containers) {
      if (c.isConnected) positionReadingGutters(c, scheduledPlacement)
    }
  })
}

// Reposition every currently-rendered reading-view note. Used on theme
// (`css-change`) and resize. Cheap: only on-screen `.markdown-preview-sizer`
// containers hold markers.
export function repositionAllReadingGutters(
  placement: SignifierPlacement
): void {
  if (placement !== 'margin' && placement !== 'margin-column') return
  const sizers = document.querySelectorAll<HTMLElement>(
    '.markdown-preview-sizer'
  )
  for (const sizer of Array.from(sizers)) {
    scheduleReadingGutters(sizer, placement)
  }
}
