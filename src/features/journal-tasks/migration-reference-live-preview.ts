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
  type EditorView,
  type PluginValue,
  type ViewUpdate,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import { editorLivePreviewField, setIcon } from 'obsidian'
import {
  type JournalFolderSettings,
  LUCIDE_MARKER_PREFIX,
} from '../../data-access'

export interface MigrationReferenceLivePreviewContext {
  getSettings: () => JournalFolderSettings
}

// A Lucide migration-reference marker found inside a line: the half-open
// `[from, to)` offsets of the `lucide:<name>` token (relative to the line
// start) plus the bare icon `name`.
export interface LucideMarkerSpan {
  from: number
  to: number
  name: string
}

// True only in Live Preview, false in plain Source mode. Migration
// markers render as icons in the rendered surfaces (reading view + Live
// Preview); Source mode shows the raw `lucide:<name>` token untouched.
function isLivePreview(view: EditorView): boolean {
  return view.state.field(editorLivePreviewField, false) ?? false
}

// Finds every configured `lucide:` marker that forms a migration
// reference inside `text` — i.e. a standalone marker token (bounded by
// whitespace / line edges) immediately followed by a `[[wikilink]]`,
// matching what `task-migration.ts` writes and what the reading-view
// post-processor renders. Only `lucide:` markers are considered: plain
// text / emoji markers already read fine as literal characters in the
// editor and need no icon substitution. Pure / unit-tested.
export function findLucideMarkerSpans(
  text: string,
  markers: readonly string[]
): LucideMarkerSpan[] {
  const candidates = markers
    .filter((m) => m.startsWith(LUCIDE_MARKER_PREFIX) && m.trim().length > 0)
    // Longest first so a more specific token wins at a shared offset.
    .sort((a, b) => b.length - a.length)
  const spans: LucideMarkerSpan[] = []
  for (const marker of candidates) {
    let from = text.indexOf(marker)
    while (from !== -1) {
      const to = from + marker.length
      const boundedBefore = from === 0 || /\s/.test(text[from - 1])
      const after = text.slice(to)
      // The marker must be a standalone token and sit just before the
      // reference link (optional whitespace, then `[[`).
      const isReference = boundedBefore && /^\s+\[\[/.test(after)
      if (isReference && !spans.some((s) => s.from < to && s.to > from)) {
        spans.push({
          from,
          to,
          name: marker.slice(LUCIDE_MARKER_PREFIX.length).trim(),
        })
      }
      from = text.indexOf(marker, from + 1)
    }
  }
  return spans.sort((a, b) => a.from - b.from)
}

// Decides whether the live-preview migration-marker decoration set must
// rebuild for a view update. Doc / viewport / settings changes always
// rebuild (they can introduce or move spans). A bare selection move only
// matters when the previous build actually found marker spans in the
// viewport — a cursor entering / leaving a span reveals / re-hides it —
// so a span-free note (the overwhelmingly common case) skips the
// per-cursor-move line walk entirely. Mirrors the signifier extension's
// gated `selectionSet` rebuild. Pure / unit-tested.
export function shouldRebuildMigrationDecorations(update: {
  docChanged: boolean
  viewportChanged: boolean
  selectionSet: boolean
  settingsChanged: boolean
  lastBuildFoundSpans: boolean
}): boolean {
  if (update.docChanged || update.viewportChanged || update.settingsChanged) {
    return true
  }
  return update.selectionSet && update.lastBuildFoundSpans
}

// Live-preview rendering of `lucide:` migration-reference markers: a
// CodeMirror `ViewPlugin` that replaces each marker token with its Lucide
// icon (faded to the configured opacity, full on hover — the same
// `.jf-migration-ref` styling as reading view). The replacement is
// revealed back to its raw text while the selection touches it so the
// token stays editable, and it is inert in Source mode (raw editing).
export function migrationReferenceLivePreviewExtension(
  ctx: MigrationReferenceLivePreviewContext
): Extension {
  return ViewPlugin.fromClass(
    class implements PluginValue {
      decorations: DecorationSet
      private lastToMarker: string
      private lastFromMarker: string
      private lastOpacity: number
      private lastLivePreview: boolean
      // Whether the last build saw any marker spans in the viewport
      // (counted BEFORE the reveal-on-selection filter — a revealed span
      // emits no decoration but still needs re-hiding on the next cursor
      // move). Gates the `selectionSet` rebuild.
      private lastBuildFoundSpans = false

      constructor(view: EditorView) {
        const s = ctx.getSettings()
        this.lastToMarker = s.taskMigrationToMarker
        this.lastFromMarker = s.taskMigrationFromMarker
        this.lastOpacity = s.taskMigrationReferenceOpacity
        this.lastLivePreview = isLivePreview(view)
        this.decorations = this.build(view)
      }

      update(update: ViewUpdate): void {
        const s = ctx.getSettings()
        const livePreview = isLivePreview(update.view)
        const settingsChanged =
          s.taskMigrationToMarker !== this.lastToMarker ||
          s.taskMigrationFromMarker !== this.lastFromMarker ||
          s.taskMigrationReferenceOpacity !== this.lastOpacity ||
          livePreview !== this.lastLivePreview
        // Rebuild on edits, scroll, and settings; selection moves only
        // matter when the viewport actually has marker spans (a cursor
        // entering / leaving one reveals / re-hides it).
        if (
          shouldRebuildMigrationDecorations({
            docChanged: update.docChanged,
            viewportChanged: update.viewportChanged,
            selectionSet: update.selectionSet,
            settingsChanged,
            lastBuildFoundSpans: this.lastBuildFoundSpans,
          })
        ) {
          this.decorations = this.build(update.view)
        }
        this.lastToMarker = s.taskMigrationToMarker
        this.lastFromMarker = s.taskMigrationFromMarker
        this.lastOpacity = s.taskMigrationReferenceOpacity
        this.lastLivePreview = livePreview
      }

      private build(view: EditorView): DecorationSet {
        this.lastBuildFoundSpans = false
        if (!isLivePreview(view)) return Decoration.none
        const s = ctx.getSettings()
        const markers = [s.taskMigrationToMarker, s.taskMigrationFromMarker]
        if (
          !markers.some((m) => m.startsWith(LUCIDE_MARKER_PREFIX) && m.trim())
        ) {
          return Decoration.none
        }
        const opacity = Math.min(
          100,
          Math.max(0, s.taskMigrationReferenceOpacity)
        )
        const selection = view.state.selection
        const collected: Range<Decoration>[] = []
        for (const { from, to } of view.visibleRanges) {
          let pos = from
          while (pos <= to) {
            const line = view.state.doc.lineAt(pos)
            for (const span of findLucideMarkerSpans(line.text, markers)) {
              this.lastBuildFoundSpans = true
              const sf = line.from + span.from
              const st = line.from + span.to
              // Reveal the raw token for editing while the cursor /
              // selection touches it.
              if (selection.ranges.some((r) => r.from <= st && r.to >= sf)) {
                continue
              }
              collected.push(
                Decoration.replace({
                  widget: new MigrationMarkerWidget(span.name, opacity),
                }).range(sf, st)
              )
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

// Renders a single `lucide:<name>` migration marker as its icon, wrapped
// in `.jf-migration-ref` so it inherits the same fade-to-opacity /
// full-on-hover styling the reading-view reference uses.
class MigrationMarkerWidget extends WidgetType {
  constructor(
    private readonly name: string,
    private readonly opacity: number
  ) {
    super()
  }

  eq(other: MigrationMarkerWidget): boolean {
    return other.name === this.name && other.opacity === this.opacity
  }

  toDOM(): HTMLElement {
    const wrapper = activeWindow.createSpan()
    wrapper.className = 'jf-migration-ref jf-migration-ref-live'
    wrapper.style.setProperty(
      '--jf-migration-ref-opacity',
      String(this.opacity / 100)
    )
    const icon = activeWindow.createSpan()
    icon.className = 'jf-migration-ref-icon'
    setIcon(icon, this.name)
    wrapper.appendChild(icon)
    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}
