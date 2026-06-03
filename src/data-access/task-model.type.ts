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

import type { TaskStatusId } from './journal-task'

export type { TaskStatusId }

// A colour reference — prefer the `token` form so the icon follows
// the active theme automatically. `literal` is the escape hatch for
// users who insist on a specific RGB value.
export type ColorRef =
  | { kind: 'token'; var: string }     // CSS variable name, e.g. '--color-green'
  | { kind: 'literal'; value: string } // raw CSS colour, e.g. '#34a853'

// Where the inner glyph comes from. `none` lets the shell stand on
// its own (an empty ring, a filled dot) without an icon inside.
// The `svg` kind accepts raw SVG markup; the renderer pipes it
// through `sanitizeSvg` before injection so disallowed tags /
// attributes / `javascript:` URLs are stripped.
export type IconSource =
  | { kind: 'none' }
  | { kind: 'lucide'; name: string }
  | { kind: 'emoji'; emoji: string }
  | { kind: 'image'; url: string }
  | { kind: 'svg'; markup: string }

export interface IconSpec {
  source: IconSource
  // Foreground colour for monochrome glyphs (Lucide, monochrome SVG).
  // Ignored for emoji / colour images. Default if omitted: inherit.
  color?: ColorRef
  // How much of the shell the inner icon fills, as a fraction (0..1).
  // Default ~0.7 — leaves a small ring of background around the
  // glyph so a check / X reads cleanly inside a filled circle.
  inset?: number
}

export type ShellShape = 'none' | 'circle' | 'square' | 'rounded-square'

export interface ShellAppearance {
  shape: ShellShape
  // null / undefined → transparent. Pair with `border` for an
  // outlined look (open status), or set a colour for a fill
  // (done / cancelled).
  background?: ColorRef
  // null / undefined → no border. Set both fields for an outlined
  // ring (open status). The width is in CSS pixels and is applied
  // uniformly on every side.
  border?: { color: ColorRef; width: number } | null
}

export interface TaskStatus {
  id: TaskStatusId
  label: string
  // On-disk character (`' '`, `'x'`, `'/'`, `'>'`, `'-'`). Mandatory —
  // this is what the model parses out of the markdown source and
  // writes back when a status cycles.
  char: string
  // Drives the *Show / Hide completed* filter on the task panels.
  // True for any status the user considers "completed-equivalent"
  // (typically done / migrated / cancelled).
  isDone: boolean
  // Per-status forward link — the status the left-click cycle moves
  // to from here. Lets the user define arbitrary flows (linear,
  // branching-via-menu, dead-end) without a model-level cycle map.
  // If the referenced id doesn't exist (e.g. the status was deleted
  // after this one was authored), the cycle falls back to the first
  // status in the active flow.
  next: TaskStatusId
  // How this status renders in the task panels and document body:
  //   `'plugin'` — the plugin paints its own shell + icon (custom
  //     fields below drive the visuals).
  //   `'theme'`  — Obsidian's native checkbox stays visible so the
  //     active theme styles it via `data-task="<char>"`. The custom
  //     shell / icon fields are ignored.
  // Per-status so a single flow can mix-and-match — themes that
  // style `[ ]` `[/]` `[x]` but not `[d]` can leave the supported
  // statuses to the theme and let the plugin paint the rest.
  rendering: TaskRendering
  // Visual record split into a shell (the frame) and an icon (the
  // glyph drawn inside the frame). Either can be `'none'`-equivalent
  // for shape-only (no icon) or icon-only (no shell) statuses.
  // Ignored when `rendering === 'theme'`.
  shell: ShellAppearance
  icon: IconSpec
}

export type TaskRendering = 'plugin' | 'theme'

export interface TaskModel {
  // Stable string identifier used for cache invalidation. Built from
  // the active status alphabet so the cache invalidates when statuses
  // are added, removed, or have their char / isDone changed — pure
  // visual edits (colour, shell shape) don't bump the id because they
  // don't affect parsed `JournalTask` data.
  id: string
  // Display order — drives both the right-click status menu and the
  // priority used by `parseLine` (first matching char wins).
  statuses: TaskStatus[]
  parseLine(line: string): { status: TaskStatusId; text: string } | null
  // Returns the full bracketed token (`'[x]'`) for the given status,
  // including the brackets so callers don't have to assemble it.
  serializeStatus(status: TaskStatusId): string
  // Drives the *Show / Hide completed* filter — true for any status
  // that shouldn't appear when the user has hidden completed tasks.
  isDone(status: TaskStatusId): boolean
  // The left-click cycle target for the current status. Reads the
  // per-status `next` field; falls back to the first status when the
  // target id is missing from the active flow.
  nextStatus(current: TaskStatusId): TaskStatusId
}

// ---------------- helpers ----------------------------------------

// Resolves a ColorRef to a CSS value string suitable for inline
// styles or computed CSS. Tokens become `var(--name)`, literals pass
// through verbatim. Used by both the Svelte renderer and the
// document-side TS renderers so a single source of truth governs
// how a `ColorRef` lands on the page.
export function colorRefToCss(ref: ColorRef | undefined): string | null {
  if (!ref) return null
  if (ref.kind === 'token') return `var(${ref.var})`
  return ref.value
}
