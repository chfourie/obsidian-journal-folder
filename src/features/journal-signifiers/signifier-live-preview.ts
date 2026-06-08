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
import { type App, editorLivePreviewField, setIcon } from 'obsidian'
import {
  type JournalFolderSettings,
  type Signifier,
  type SignifierPlacement,
  extractTags,
  extractTagSpans,
  matchSignifiers,
} from '../../data-access'
import { renderSignifierIcon } from './render-signifier-icon'
import { computeSignifierLineEdit } from './signifier-line-edit'
import { SignifierPickerModal } from './signifier-picker-modal'
import {
  COLUMN_INSET_PX,
  EDGE_MARGIN_PX,
  ROW_GAP_PX,
  computeReserve,
  maxGutterReserve,
} from './gutter-positioner'

export interface SignifierLivePreviewContext {
  getSettings: () => JournalFolderSettings
  // App handle so a click on a gutter marker can open the signifier picker.
  app: App
}

// A line can receive a signifier (and therefore an inline add affordance) as
// long as it has some non-whitespace content — appending `#tag` to a blank
// line is meaningless, and a blank-line affordance would pepper every empty
// line in the editor with a hover target. Pure / unit-tested.
export function lineCanReceiveSignifier(text: string): boolean {
  return text.trim().length > 0
}

// True only when the editor is in Live Preview, false in plain Source
// mode. Signifier icons + tag-hiding are a *rendered* affordance: in
// Source mode the user is looking at raw markdown, so the matched tag
// text must stay visible (and we paint no gutter icons). Obsidian's
// `editorLivePreviewField` is the canonical flag; `false` as the
// fallback keeps us inert if the field is ever absent.
function isLivePreview(view: EditorView): boolean {
  return view.state.field(editorLivePreviewField, false) ?? false
}

// A click anywhere on an editing-view signifier gutter (the icon stack on a
// line that already has signifiers, or the faint hover affordance on a line
// that doesn't) opens the picker pre-checked for that line and writes the
// recomputed line back through the editor's own transaction. Returns true when
// it consumed the event so CodeMirror skips its default selection handling.
function openPickerFromGutterEvent(
  event: MouseEvent,
  view: EditorView,
  ctx: SignifierLivePreviewContext
): boolean {
  const target = event.target as HTMLElement | null
  const gutter = target?.closest<HTMLElement>(
    '.jf-signifier-gutter.jf-signifier-live'
  )
  if (!gutter) return false
  const signifiers = ctx.getSettings().signifiers
  if (signifiers.length === 0) return false
  let pos: number
  try {
    pos = view.posAtDOM(gutter)
  } catch {
    return false
  }
  // Resolve by line NUMBER, not offset: the doc can change while the modal is
  // open, so re-look-up the line at apply time before rewriting it.
  const lineNumber = view.state.doc.lineAt(pos).number
  event.preventDefault()
  new SignifierPickerModal(
    ctx.app,
    signifiers,
    view.state.doc.line(lineNumber).text,
    (ids) => {
      const line = view.state.doc.line(lineNumber)
      const updated = computeSignifierLineEdit(line.text, signifiers, ids)
      if (updated === line.text) return
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: updated },
      })
    }
  ).open()
  return true
}

// Live-preview (editing-view) signifier rendering. A CodeMirror
// `ViewPlugin` that, for every line carrying a configured signifier tag,
// paints the signifier icon(s) in a left-margin gutter (an absolutely-
// positioned side `-1` widget whose `left` is measured — see
// `measureGutters`), mirroring the reading-view placement. When
// `signifierHideTagInLivePreview` is on, the matched tag token is also
// hidden via a `replace` decoration, BUT revealed while the cursor /
// selection touches it so it stays editable. A settings change re-applies
// editor extensions (see `JournalSignifiersFeature.useSettings`).
export function signifierLivePreviewExtension(
  ctx: SignifierLivePreviewContext
): Extension {
  const viewPlugin = ViewPlugin.fromClass(
    class implements PluginValue {
      decorations: DecorationSet
      private lastPlacement: SignifierPlacement
      private lastHideTag: boolean
      private lastRevealActiveLine: boolean
      private lastLivePreview: boolean

      constructor(view: EditorView) {
        const s = ctx.getSettings()
        this.lastPlacement = s.signifierPlacement
        this.lastHideTag = s.signifierHideTagInLivePreview
        this.lastRevealActiveLine = s.signifierShowTagsOnActiveLine
        this.lastLivePreview = isLivePreview(view)
        this.decorations = this.build(view)
        this.measureGutters(view)
      }

      update(update: ViewUpdate): void {
        const settings = ctx.getSettings()
        const placement = settings.signifierPlacement
        const hideTag = settings.signifierHideTagInLivePreview
        const revealActiveLine = settings.signifierShowTagsOnActiveLine
        const livePreview = isLivePreview(update.view)
        // A settings toggle reaches us via the reconfigure transaction
        // (`updateOptions`); treat placement / hide-tag / reveal changes — and
        // a Live Preview ⇄ Source mode switch — as a rebuild.
        const settingsChanged =
          placement !== this.lastPlacement ||
          hideTag !== this.lastHideTag ||
          revealActiveLine !== this.lastRevealActiveLine ||
          livePreview !== this.lastLivePreview
        // When tag-hiding is on, a cursor move can reveal / re-hide a tag, so
        // the decoration set must rebuild on `selectionSet` too.
        const rebuild =
          update.docChanged ||
          update.viewportChanged ||
          settingsChanged ||
          (update.selectionSet && hideTag)
        if (rebuild) {
          this.decorations = this.build(update.view)
        }
        // Re-measure gutter positions on any geometry change too
        // (`geometryChanged` fires on window resize / font / readable-width),
        // since the single column's offset includes the indentation.
        //
        // Deliberately NOT on `selectionSet`: gutter `left`s and the reserved
        // lane depend only on layout geometry, not the cursor. Measuring on
        // every cursor move made the lane flicker (and sometimes collapse and
        // stay collapsed) because a transient `coordsAtPos` miss mid-navigation
        // released it. Revealing a tag reuses the existing widget DOM, so its
        // already-measured `left` survives the rebuild without re-measuring.
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.geometryChanged ||
          settingsChanged
        ) {
          this.measureGutters(update.view)
        }
        this.lastPlacement = placement
        this.lastHideTag = hideTag
        this.lastRevealActiveLine = revealActiveLine
        this.lastLivePreview = livePreview
      }

      // Position the editing-view gutter markers by measurement, using
      // CodeMirror's own `coordsAtPos` (theme-independent) inside a batched
      // `requestMeasure` (reads then writes — no layout thrash). The marker
      // is an absolutely-positioned child of its `.cm-line` host; we set its
      // `left` so it hangs left of the line's list marker (per row) or lands
      // in one shared far-left column (single column). We also reserve a
      // left lane on `.cm-content` so the widest stack never clips.
      private measureGutters(view: EditorView): void {
        // Source mode paints no gutter markers, so there is nothing to
        // measure — release any lane we reserved while in Live Preview.
        if (!isLivePreview(view)) {
          applyContentReserve(view.contentDOM, null)
          return
        }
        const placement = ctx.getSettings().signifierPlacement
        const isMargin =
          placement === 'margin' || placement === 'margin-column'
        view.requestMeasure({
          key: 'jf-signifier-gutters',
          read: (v) => {
            if (!isMargin) return { lefts: [], reserve: null }
            const { lefts, minIconLeft, maxWidth } = measureGutterLefts(
              v,
              placement
            )
            // `reserve === null` releases the lane. When the toggle is on,
            // reserve only the deficit by which the leftmost icon would clip
            // past the editor's edge (0 when the existing margin fits).
            let reserve: number | null = null
            if (ctx.getSettings().signifierReserveGutter) {
              if (minIconLeft !== Infinity) {
                const clipLeft =
                  v.scrollDOM.getBoundingClientRect().left + EDGE_MARGIN_PX
                const applied = cmAppliedShortfall.get(v.contentDOM) ?? 0
                // Clamp to the icon stack's own extent — a transient
                // mis-measurement must never push content off screen.
                reserve = Math.min(
                  computeReserve(minIconLeft - applied, clipLeft),
                  maxGutterReserve(maxWidth)
                )
              } else if (
                v.dom.querySelector(
                  '.cm-line.jf-signifier-host .jf-signifier-gutter:not(.jf-signifier-add-gutter)'
                )
              ) {
                // Markers ARE present but the measurement transiently failed
                // (e.g. `coordsAtPos` returned null mid-layout). Keep the lane
                // we already reserved instead of releasing it — releasing here
                // is what made the margin collapse and shift content. Re-applying
                // the same value is a no-op.
                reserve = cmAppliedShortfall.get(v.contentDOM) ?? null
              }
            }
            return { lefts, reserve }
          },
          write: ({ lefts, reserve }, v) => {
            for (const { marker, left, top } of lefts) {
              marker.style.left = `${left}px`
              // Drop the marker past any host line top-padding (heading lines)
              // so it centres on the text, not the padded box. 0 elsewhere.
              marker.style.top = `${top}px`
              marker.classList.add('jf-positioned')
            }
            applyContentReserve(v.contentDOM, reserve)
          },
        })
      }

      private build(view: EditorView): DecorationSet {
        // Source mode is a raw editing experience: no gutter icons, no
        // add affordance, no tag-hiding. All of that is Live-Preview only.
        if (!isLivePreview(view)) return Decoration.none
        const settings = ctx.getSettings()
        const signifiers = settings.signifiers
        if (signifiers.length === 0) return Decoration.none
        const placement = settings.signifierPlacement
        const hideTag = settings.signifierHideTagInLivePreview
        const revealActiveLine = settings.signifierShowTagsOnActiveLine
        const selection = view.state.selection
        const collected: Range<Decoration>[] = []

        for (const { from, to } of view.visibleRanges) {
          let pos = from
          while (pos <= to) {
            const line = view.state.doc.lineAt(pos)
            const matched = matchSignifiers(extractTags(line.text), signifiers)
            if (matched.length === 0) {
              // No signifier yet: hang a faint, clickable add affordance in
              // the same gutter so the user can attach one without typing a
              // tag. Hidden until the line / affordance is hovered (CSS); it
              // shares the gutter measurement so it lands in the right column.
              if (lineCanReceiveSignifier(line.text)) {
                const widgetPos = line.from + contentStartOffset(line.text)
                collected.push(
                  Decoration.line({ class: 'jf-signifier-host' }).range(
                    line.from
                  )
                )
                const depth =
                  placement === 'margin-column'
                    ? indentDepth(line.text, view.state.tabSize)
                    : null
                const cls =
                  placement === 'margin-column'
                    ? 'jf-signifier-gutter jf-signifier-column'
                    : 'jf-signifier-gutter'
                collected.push(
                  Decoration.widget({
                    widget: new SignifierAddWidget(cls, depth),
                    side: -1,
                  }).range(widgetPos)
                )
              }
            } else {
              // Both placements are left-margin gutters: the line becomes the
              // positioning context (`jf-signifier-host`) and the icon marker
              // is placed after the line's `- [ ]` / bullet prefix so it sits
              // in the right `.cm-line`; CSS + the measured `left` hang it just
              // left of the line, vertically centred.
              const widgetPos = line.from + contentStartOffset(line.text)
              collected.push(
                Decoration.line({ class: 'jf-signifier-host' }).range(line.from)
              )
              // Single-column variant carries the column modifier + the line's
              // indentation depth so CSS can pull every icon back into one
              // shared far-left column.
              const depth =
                placement === 'margin-column'
                  ? indentDepth(line.text, view.state.tabSize)
                  : null
              const cls =
                placement === 'margin-column'
                  ? 'jf-signifier-gutter jf-signifier-column'
                  : 'jf-signifier-gutter'
              collected.push(
                Decoration.widget({
                  widget: new SignifierWidget(matched, cls, depth),
                  side: -1,
                }).range(widgetPos)
              )

              // Hide each matched tag token (parity with reading view), but
              // reveal it for editing per `computeTagHideRanges` — either the
              // single tag under the cursor, or every tag on the active line.
              if (hideTag) {
                const tagRanges: TagRange[] = []
                for (const span of extractTagSpans(line.text)) {
                  if (matchSignifiers([span.name], signifiers).length === 0) {
                    continue
                  }
                  tagRanges.push({
                    from: line.from + span.start,
                    to: line.from + span.end,
                  })
                }
                for (const r of computeTagHideRanges(
                  line.from,
                  line.to,
                  tagRanges,
                  selection.ranges,
                  revealActiveLine
                )) {
                  collected.push(Decoration.replace({}).range(r.from, r.to))
                }
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
  // `mousedown` (not `click`) so we consume the event before CodeMirror moves
  // the cursor / starts a selection in the margin the gutter lives in.
  const clickHandler = EditorView.domEventHandlers({
    mousedown: (event, view) => openPickerFromGutterEvent(event, view, ctx),
  })
  return [viewPlugin, clickHandler]
}

// A half-open `[from, to)` document range (CodeMirror offsets).
export interface TagRange {
  from: number
  to: number
}

// Decides which of a line's signifier-tag ranges to HIDE in live preview,
// given the editor selection. A tag stays hidden unless it is "revealed" for
// editing:
//   - `revealActiveLine` true  — placing the cursor / a selection anywhere on
//     the line reveals ALL of the line's tags (returns none to hide).
//   - `revealActiveLine` false — only the tag the selection actually touches
//     is revealed; the rest stay hidden.
// Pure / unit-tested. `lineFrom` / `lineTo` are the line's document offsets.
export function computeTagHideRanges(
  lineFrom: number,
  lineTo: number,
  tagRanges: readonly TagRange[],
  selectionRanges: readonly { from: number; to: number }[],
  revealActiveLine: boolean
): TagRange[] {
  const lineActive =
    revealActiveLine &&
    selectionRanges.some((r) => r.from <= lineTo && r.to >= lineFrom)
  if (lineActive) return []
  return tagRanges.filter(
    (t) => !selectionRanges.some((r) => r.from <= t.to && r.to >= t.from)
  )
}

// Offset within a line to the start of its content — past leading
// indentation and any list marker (`- `, `* `, `1. `) and task checkbox
// (`[ ] `). 0 for a plain paragraph line. Used so a `margin` widget sits
// before the entry text and inherits the line's indentation, instead of
// snapping to the far-left column at `line.from`.
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
): {
  lefts: { marker: HTMLElement; left: number; top: number }[]
  minIconLeft: number
  maxWidth: number
} {
  // Gather the gutter-bearing lines first (all reads happen in this measure
  // phase — no writes).
  const rows: {
    marker: HTMLElement
    line: { from: number; text: string }
    hostLeft: number
    width: number
    // The host line's top padding (px). Obsidian gives heading lines
    // `padding-top: var(--p-spacing)` (~16px) in the editor, so the `top:0`
    // gutter would float in that padding strip ABOVE the heading text; we push
    // the marker down by it (written as inline `top`). 0 for body / list lines.
    top: number
    // The left edge (viewport px) of the line's RENDERED list marker, when the
    // line has one. `coordsAtPos` at the marker character lands ~one indent step
    // RIGHT of the visible bullet in Live Preview (measured ~12px, widened
    // further by the Outliner plugin), so the per-row icon drifts off its entry;
    // anchoring on the real bullet keeps it a fixed gap left of the bullet.
    // `null` for non-list lines (paragraphs / headings) → fall back to coords.
    bulletLeft: number | null
    // The faint add affordance on a line with no signifier yet. It still gets
    // positioned (so it lands in the gutter column), but it must not influence
    // the reserved lane — an invisible hover target should never push content.
    isAdd: boolean
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
    const bullet = lineEl.querySelector<HTMLElement>('.cm-formatting-list')
    rows.push({
      marker,
      line,
      hostLeft: lineEl.getBoundingClientRect().left,
      width: marker.getBoundingClientRect().width,
      top: parseFloat(getComputedStyle(lineEl).paddingTop) || 0,
      bulletLeft: bullet ? bullet.getBoundingClientRect().left : null,
      isAdd: marker.classList.contains('jf-signifier-add-gutter'),
    })
  }

  // Build the host-relative `left`s plus the leftmost icon's viewport x (the
  // icon's visible left edge — CSS `translateX(-100%)` shifts it left of its
  // box by its own width). The leftmost feeds the reserve-deficit calc; the
  // widest marker bounds it (the lane can never need more than the icon stack
  // plus the gaps — a clamp against a runaway mis-measurement).
  const maxWidth = rows.reduce(
    (m, r) => (r.isAdd ? m : Math.max(m, r.width)),
    0
  )
  const lefts: { marker: HTMLElement; left: number; top: number }[] = []
  let minIconLeft = Infinity
  const push = (
    marker: HTMLElement,
    left: number,
    top: number,
    hostLeft: number,
    w: number,
    isAdd: boolean
  ) => {
    lefts.push({ marker, left, top })
    if (isAdd) return
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
    if (columnX === null) return { lefts: [], minIconLeft, maxWidth }
    const target = columnX - COLUMN_INSET_PX
    for (const r of rows)
      push(r.marker, target - r.hostLeft, r.top, r.hostLeft, r.width, r.isAdd)
    return { lefts, minIconLeft, maxWidth }
  }

  // Per-row: just left of each line's list marker so the icon hangs in the
  // margin indented with nesting (CSS `translateX(-100%)` shifts it left of the
  // anchor by its own width). Prefer the RENDERED bullet's left edge — in Live
  // Preview `coordsAtPos` at the marker character sits ~one indent step right of
  // the visible bullet (worse under Outliner), so the icon drifts off its entry.
  // Non-list lines (paragraphs / headings) have no bullet → anchor on the line's
  // content coordinate past the leading indentation.
  for (const r of rows) {
    let anchorLeft = r.bulletLeft
    if (anchorLeft === null) {
      const markStart = view.coordsAtPos(
        r.line.from + leadingWhitespaceLength(r.line.text)
      )
      if (!markStart) continue
      anchorLeft = markStart.left
    }
    push(
      r.marker,
      anchorLeft - ROW_GAP_PX - r.hostLeft,
      r.top,
      r.hostLeft,
      r.width,
      r.isAdd
    )
  }
  return { lefts, minIconLeft, maxWidth }
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
    content.style.removeProperty('padding-inline-start')
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

// Renders the signifier icons for a line as a single gutter marker.
// `className` is the gutter styling (`jf-signifier-gutter`, plus
// `jf-signifier-column` for the single-column variant).
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
    const marker = activeDocument.createElement('span')
    marker.className = `${this.className} jf-signifier-live`
    marker.setAttribute('aria-hidden', 'true')
    if (this.depth !== null) {
      marker.style.setProperty('--jf-sig-depth', String(this.depth))
    }
    for (const signifier of this.signifiers) {
      const icon = activeDocument.createElement('span')
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

// The hover affordance painted in the gutter of a line that has NO signifier
// yet: a faint plus icon that fades in on hover and, when clicked, opens the
// picker for that line (see `openPickerFromGutterEvent`). It reuses the
// gutter measurement / column positioning so it sits exactly where a real
// icon would, but carries `jf-signifier-add-gutter` so the reserve pass can
// ignore it (an invisible affordance must never widen the reserved lane).
class SignifierAddWidget extends WidgetType {
  constructor(
    private readonly className: string,
    private readonly depth: number | null = null
  ) {
    super()
  }

  eq(other: SignifierAddWidget): boolean {
    return other.className === this.className && other.depth === this.depth
  }

  toDOM(): HTMLElement {
    const marker = activeDocument.createElement('span')
    marker.className = `${this.className} jf-signifier-add-gutter jf-signifier-live`
    marker.setAttribute('aria-label', 'Edit signifiers on this line')
    if (this.depth !== null) {
      marker.style.setProperty('--jf-sig-depth', String(this.depth))
    }
    const add = activeDocument.createElement('span')
    add.className = 'jf-signifier jf-signifier-add'
    setIcon(add, 'plus')
    marker.appendChild(add)
    return marker
  }

  ignoreEvent(): boolean {
    return false
  }
}
