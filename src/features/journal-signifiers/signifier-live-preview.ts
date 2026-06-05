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

import { type Extension, type Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type PluginValue,
  type ViewUpdate,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import {
  type JournalFolderSettings,
  type Signifier,
  type SignifierPlacement,
  extractTags,
  matchSignifiers,
} from '../../data-access'
import { renderSignifierIcon } from './render-signifier-icon'
import {
  COLUMN_INSET_PX,
  EDGE_MARGIN_PX,
  ROW_GAP_PX,
  computeReserve,
} from './gutter-positioner'

export interface SignifierLivePreviewContext {
  getSettings: () => JournalFolderSettings
}

// Live-preview (editing-view) signifier rendering. A CodeMirror
// `ViewPlugin` that, for every line carrying a configured signifier tag,
// paints the signifier icon(s) at the START of the line in normal flow
// (a side `-1` widget) — the tag text is left untouched and fully
// editable. Flow placement (rather than an absolutely-positioned margin
// marker) is deliberate: it can never overlap the bullet / checkbox and is
// immune to themes and CSS snippets that restyle list layout. Nothing is
// hidden or replaced, so there is no reveal-on-edit dance and no way for
// the decoration to interfere with typing. Gated by
// `signifierLivePreviewEnabled`; a settings change re-applies editor
// extensions (see `JournalSignifiersFeature.useSettings`).
export function signifierLivePreviewExtension(
  ctx: SignifierLivePreviewContext
): Extension {
  return ViewPlugin.fromClass(
    class implements PluginValue {
      decorations: DecorationSet
      private lastPlacement: SignifierPlacement

      constructor(view: EditorView) {
        this.lastPlacement = ctx.getSettings().signifierPlacement
        this.decorations = this.build(view)
        this.measureGutters(view)
      }

      update(update: ViewUpdate): void {
        const placement = ctx.getSettings().signifierPlacement
        const placementChanged = placement !== this.lastPlacement
        if (update.docChanged || update.viewportChanged || placementChanged) {
          this.decorations = this.build(update.view)
        }
        // Re-measure gutter positions on any geometry change too
        // (`geometryChanged` fires on window resize / font / readable-width),
        // since the single column's offset includes the indentation. A
        // placement change must also re-run so the reserved lane is applied
        // or cleared.
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.geometryChanged ||
          placementChanged
        ) {
          this.measureGutters(update.view)
        }
        this.lastPlacement = placement
      }

      // Position the editing-view gutter markers by measurement, using
      // CodeMirror's own `coordsAtPos` (theme-independent) inside a batched
      // `requestMeasure` (reads then writes — no layout thrash). The marker
      // is an absolutely-positioned child of its `.cm-line` host; we set its
      // `left` so it hangs left of the line's list marker (per row) or lands
      // in one shared far-left column (single column). We also reserve a
      // left lane on `.cm-content` so the widest stack never clips.
      private measureGutters(view: EditorView): void {
        const placement = ctx.getSettings().signifierPlacement
        const isMargin =
          placement === 'margin' || placement === 'margin-column'
        view.requestMeasure({
          key: 'jf-signifier-gutters',
          read: (v) => {
            if (!isMargin) return { lefts: [], reserve: null }
            const { lefts, minIconLeft } = measureGutterLefts(v, placement)
            // Reserve is opt-in (off by default); null releases the lane. When
            // on, reserve only the deficit by which the leftmost icon would
            // clip past the editor's edge (0 when the existing margin fits).
            let reserve: number | null = null
            if (
              ctx.getSettings().signifierReserveGutter &&
              minIconLeft !== Infinity
            ) {
              const clipLeft =
                v.scrollDOM.getBoundingClientRect().left + EDGE_MARGIN_PX
              const applied = cmAppliedShortfall.get(v.contentDOM) ?? 0
              reserve = computeReserve(minIconLeft - applied, clipLeft)
            }
            return { lefts, reserve }
          },
          write: ({ lefts, reserve }, v) => {
            for (const { marker, left } of lefts) {
              marker.style.left = `${left}px`
              marker.classList.add('jf-positioned')
            }
            applyContentReserve(v.contentDOM, reserve)
          },
        })
      }

      private build(view: EditorView): DecorationSet {
        const settings = ctx.getSettings()
        const signifiers = settings.signifiers
        if (!settings.signifierLivePreviewEnabled || signifiers.length === 0) {
          return Decoration.none
        }
        const collected: Range<Decoration>[] = []

        for (const { from, to } of view.visibleRanges) {
          let pos = from
          while (pos <= to) {
            const line = view.state.doc.lineAt(pos)
            const matched = matchSignifiers(
              extractTags(line.text),
              signifiers
            )
            if (matched.length > 0) {
              const placement = settings.signifierPlacement ?? 'start'
              if (placement === 'end') {
                collected.push(
                  Decoration.widget({
                    widget: new SignifierWidget(matched, 'jf-signifier-trail'),
                    side: 1,
                  }).range(line.to)
                )
              } else {
                // Place after the line's `- [ ]` / bullet prefix (and the
                // leading indentation) so the icon sits before the entry
                // text and inherits the line's indent. For the margin modes
                // the line becomes the positioning context
                // (`jf-signifier-host`) so CSS can hang the marker just left
                // of it, vertically centred.
                const isMargin =
                  placement === 'margin' || placement === 'margin-column'
                const widgetPos = line.from + contentStartOffset(line.text)
                if (isMargin) {
                  collected.push(
                    Decoration.line({ class: 'jf-signifier-host' }).range(
                      line.from
                    )
                  )
                }
                // Single-column variant carries the column modifier + the
                // line's indentation depth so CSS can pull every icon back
                // into one shared far-left column.
                const depth =
                  placement === 'margin-column'
                    ? indentDepth(line.text, view.state.tabSize)
                    : null
                const cls = !isMargin
                  ? 'jf-signifier-lead'
                  : placement === 'margin-column'
                    ? 'jf-signifier-gutter jf-signifier-column'
                    : 'jf-signifier-gutter'
                collected.push(
                  Decoration.widget({
                    widget: new SignifierWidget(matched, cls, depth),
                    side: -1,
                  }).range(widgetPos)
                )
              }
            }
            pos = line.to + 1
          }
        }
        return Decoration.set(collected, true)
      }
    },
    { decorations: (v) => v.decorations }
  )
}

// Offset within a line to the start of its content — past leading
// indentation and any list marker (`- `, `* `, `1. `) and task checkbox
// (`[ ] `). 0 for a plain paragraph line. Used so a `start` / `margin`
// widget sits before the entry text and inherits the line's indentation,
// instead of snapping to the far-left column at `line.from`.
function contentStartOffset(text: string): number {
  const match = text.match(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[^\]]\]\s+)?/)
  return match ? match[0].length : 0
}

// READ step for the editing-view gutter measurement: for every `.cm-line`
// carrying a gutter marker, compute the marker's `left` (relative to the line
// host) from CodeMirror coordinates. `margin` hangs the icon just left of the
// line's list marker (indented with nesting); `margin-column` lands every icon
// in one shared far-left column at the editor's text origin. Returns the
// writes to apply — no DOM is mutated here.
function measureGutterLefts(
  view: EditorView,
  placement: 'margin' | 'margin-column'
): { lefts: { marker: HTMLElement; left: number }[]; minIconLeft: number } {
  // Gather the gutter-bearing lines first (all reads happen in this measure
  // phase — no writes).
  const rows: {
    marker: HTMLElement
    line: { from: number; text: string }
    hostLeft: number
    width: number
  }[] = []
  const lineEls = view.dom.querySelectorAll<HTMLElement>(
    '.cm-line.jf-signifier-host'
  )
  for (const lineEl of Array.from(lineEls)) {
    const marker = lineEl.querySelector<HTMLElement>('.jf-signifier-gutter')
    if (!marker) continue
    let pos: number
    try {
      pos = view.posAtDOM(lineEl)
    } catch {
      continue
    }
    const line = view.state.doc.lineAt(pos)
    rows.push({
      marker,
      line,
      hostLeft: lineEl.getBoundingClientRect().left,
      width: marker.getBoundingClientRect().width,
    })
  }

  // Build the host-relative `left`s plus the leftmost icon's viewport x (the
  // icon's visible left edge — CSS `translateX(-100%)` shifts it left of its
  // box by its own width). The leftmost feeds the reserve-deficit calc.
  const lefts: { marker: HTMLElement; left: number }[] = []
  let minIconLeft = Infinity
  const push = (marker: HTMLElement, left: number, hostLeft: number, w: number) => {
    lefts.push({ marker, left })
    const iconLeft = hostLeft + left - w
    if (iconLeft < minIconLeft) minIconLeft = iconLeft
  }

  if (placement === 'margin-column') {
    // Use ONE shared anchor — the leftmost line-start across the visible
    // lines — so every icon lands in a single column. Per-line `coordsAtPos`
    // differs slightly between top-level and nested lines (list-marker
    // rendering), so anchoring each independently makes the column ragged.
    let columnX: number | null = null
    for (const r of rows) {
      const origin = view.coordsAtPos(r.line.from)
      if (origin) {
        columnX = columnX === null ? origin.left : Math.min(columnX, origin.left)
      }
    }
    if (columnX === null) return { lefts: [], minIconLeft }
    const target = columnX - COLUMN_INSET_PX
    for (const r of rows) push(r.marker, target - r.hostLeft, r.hostLeft, r.width)
    return { lefts, minIconLeft }
  }

  // Per-row: just left of each line's list marker — past the leading
  // indentation but BEFORE the bullet / checkbox — so the icon hangs in the
  // margin indented with nesting (CSS `translateX(-100%)` shifts it left of
  // this point by its own width).
  for (const r of rows) {
    const markStart = view.coordsAtPos(
      r.line.from + leadingWhitespaceLength(r.line.text)
    )
    if (!markStart) continue
    push(r.marker, markStart.left - ROW_GAP_PX - r.hostLeft, r.hostLeft, r.width)
  }
  return { lefts, minIconLeft }
}

// The editor content's own CSS padding-inline-start (px), cached before we
// override it so the reserved deficit is added on top and never compounds.
const cmReserveBase = new WeakMap<HTMLElement, number>()
// The deficit we're currently adding (subtracted from the measured icon x to
// recover its natural position, so the next pass doesn't oscillate).
const cmAppliedShortfall = new WeakMap<HTMLElement, number>()

// Reserve (or, when `reserve` is null / 0, release) the left lane on
// `.cm-content` — only the deficit by which the leftmost editing-view icon
// would clip past the editor edge, so nothing is added when the existing
// margin already fits.
function applyContentReserve(
  content: HTMLElement,
  reserve: number | null
): void {
  if (reserve === null || reserve <= 0) {
    content.style.paddingInlineStart = ''
    cmAppliedShortfall.set(content, 0)
    return
  }
  let base = cmReserveBase.get(content)
  if (base === undefined) {
    base = parseFloat(getComputedStyle(content).paddingInlineStart) || 0
    cmReserveBase.set(content, base)
  }
  content.style.paddingInlineStart = `${base + reserve}px`
  cmAppliedShortfall.set(content, reserve)
}

// Length of a line's leading whitespace (the indentation before its list
// marker). Used as the row-gutter anchor so the icon hangs left of the
// bullet / checkbox, not left of the entry text.
function leadingWhitespaceLength(text: string): number {
  return text.match(/^[\t ]*/)?.[0].length ?? 0
}

// List-nesting depth of a line from its leading indentation: each tab is one
// level, and every `tabSize` leading spaces is one level. Mirrors how the
// reading-view `listDepth` counts ancestor lists, so the single-column gutter
// lands at the same column in both views. Pure / unit-testable.
export function indentDepth(text: string, tabSize: number): number {
  const lead = text.match(/^[\t ]*/)?.[0] ?? ''
  let depth = 0
  let spaces = 0
  const step = tabSize > 0 ? tabSize : 4
  for (const ch of lead) {
    if (ch === '\t') {
      depth++
      spaces = 0
    } else {
      spaces++
      if (spaces >= step) {
        depth++
        spaces = 0
      }
    }
  }
  // A list line indents content one level past the bullet even at top level;
  // match reading view where a top-level `<li>` has one ancestor `<ul>`.
  return depth + 1
}

// Renders the signifier icons for a line as a single marker. `className`
// selects the placement styling (`jf-signifier-lead` / `-trail` /
// `-gutter`).
class SignifierWidget extends WidgetType {
  constructor(
    private readonly signifiers: Signifier[],
    private readonly className: string,
    private readonly depth: number | null = null
  ) {
    super()
  }

  eq(other: SignifierWidget): boolean {
    if (other.className !== this.className) return false
    if (other.depth !== this.depth) return false
    if (other.signifiers.length !== this.signifiers.length) return false
    return this.signifiers.every((s, i) => s.id === other.signifiers[i].id)
  }

  toDOM(): HTMLElement {
    const marker = document.createElement('span')
    marker.className = `${this.className} jf-signifier-live`
    marker.setAttribute('aria-hidden', 'true')
    if (this.depth !== null) {
      marker.style.setProperty('--jf-sig-depth', String(this.depth))
    }
    for (const signifier of this.signifiers) {
      const icon = document.createElement('span')
      icon.className = 'jf-signifier'
      icon.dataset.sigId = signifier.id
      renderSignifierIcon(icon, signifier.icon)
      marker.appendChild(icon)
    }
    return marker
  }

  ignoreEvent(): boolean {
    return false
  }
}
