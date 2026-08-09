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

import { setIcon, type App, type TFile } from 'obsidian'
import type { TaskModel, TaskStatusId } from './task-models'
import { renderStatusIconById } from './render-status-icon'
import { setTaskStatus, type TaskMutationTarget } from './task-transition'

// A `<body>`-portaled status picker — the in-house replacement for the
// Obsidian native `Menu` we used to open on the status icon. It matches
// the rest of the plugin's portaled panels (the sidebar More… menu, the
// task scope panel): a styled box anchored under the trigger, dismissed
// on outside-pointer / Escape / viewport change. A single instance is
// kept module-wide so a second open (or a navigation) tears the first
// one down — there's only ever one picker on screen.

// Enough to resolve a single task into a migrate action. `rawText` is
// the task line as it stands at open-time, so the migration writer can
// re-emit its body (its own line-match guard re-checks on write).
export interface StatusPickerMigrationTarget {
  sourceFile: TFile
  sourceLine: number
  rawText: string
}

export interface StatusPickerOptions {
  // The element the panel anchors under — the status icon (or the
  // native checkbox in theme rendering). Its on-screen rect drives
  // placement, so it must be a *visible* element (never a
  // `display:none` input).
  anchor: HTMLElement
  model: TaskModel
  currentStatus: TaskStatusId
  // Invoked with the chosen status id. The caller owns the write so
  // each surface can use its own writer (disk vs. live editor).
  onSelect: (statusId: TaskStatusId) => void
  // When set (and the registered migration provider deems this task
  // migratable), the panel grows a "Migrate task…" row beneath the
  // statuses.
  migrateTarget?: StatusPickerMigrationTarget
}

// Resolves a task target into a runnable migrate action, or null when
// migration doesn't apply. Registered once by `JournalTasksFeature`
// (`setStatusPickerMigrationProvider`) rather than threaded through
// every surface: the picker is a module-level imperative opener shared
// by all four checkbox surfaces, and migration capability is
// process-wide (one `MigrationMenuContext` owned by the feature, with
// folder overrides resolved per file at call time). Keeping it here
// avoids passing a migration context through Svelte props and both
// document contexts just to reach this one panel.
type MigrationProvider = (
  target: StatusPickerMigrationTarget
) => (() => void) | null

let migrationProvider: MigrationProvider | null = null

export function setStatusPickerMigrationProvider(
  provider: MigrationProvider | null
): void {
  migrationProvider = provider
}

const MARGIN = 8
const GAP = 4

let active: { destroy: () => void } | null = null

export function closeStatusPicker(): void {
  active?.destroy()
}

export function openStatusPicker(opts: StatusPickerOptions): void {
  // Only one picker at a time — drop any previous instance first.
  closeStatusPicker()

  const panel = activeWindow.createDiv()
  panel.className = 'jf-status-picker-panel'
  panel.setAttribute('role', 'menu')
  panel.setAttribute('data-jf-status-picker', '')
  panel.tabIndex = -1

  let firstFocusable: HTMLElement | null = null
  let selectedEl: HTMLElement | null = null

  for (const status of opts.model.statuses) {
    const row = activeWindow.createSpan()
    row.className = 'jf-status-picker-item'
    row.setAttribute('role', 'menuitemradio')
    row.setAttribute('data-jf-status-option', status.id)
    row.tabIndex = 0
    const selected = status.id === opts.currentStatus
    row.setAttribute('aria-checked', String(selected))
    if (selected) {
      row.classList.add('is-selected')
      selectedEl = row
    }
    if (!firstFocusable) firstFocusable = row

    const iconHost = activeWindow.createSpan()
    iconHost.className = 'jf-status-picker-icon'
    iconHost.setAttribute('aria-hidden', 'true')
    renderStatusIconById(iconHost, status.id, opts.model)
    row.appendChild(iconHost)

    const label = activeWindow.createSpan()
    label.className = 'jf-status-picker-label'
    label.textContent = status.label || status.id
    row.appendChild(label)

    const choose = () => {
      destroy()
      opts.onSelect(status.id)
    }
    row.addEventListener('click', (evt) => {
      evt.preventDefault()
      evt.stopPropagation()
      choose()
    })
    row.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault()
        choose()
      }
    })
    panel.appendChild(row)
  }

  // Append a "Migrate task…" action when this task is migratable. The
  // provider returns null for done tasks / non-journal notes / flows
  // without a migrated status, so the row simply doesn't appear there.
  const migrateRun =
    opts.migrateTarget && migrationProvider
      ? migrationProvider(opts.migrateTarget)
      : null
  if (migrateRun) {
    const sep = activeWindow.createDiv()
    sep.className = 'jf-status-picker-sep'
    panel.appendChild(sep)

    const row = activeWindow.createSpan()
    row.className = 'jf-status-picker-item jf-status-picker-migrate'
    row.setAttribute('role', 'menuitem')
    row.setAttribute('data-jf-migrate-row', '')
    row.tabIndex = 0
    if (!firstFocusable) firstFocusable = row

    const iconHost = activeWindow.createSpan()
    iconHost.className = 'jf-status-picker-icon'
    iconHost.setAttribute('aria-hidden', 'true')
    setIcon(iconHost, 'arrow-right-from-line')
    row.appendChild(iconHost)

    const label = activeWindow.createSpan()
    label.className = 'jf-status-picker-label'
    label.textContent = 'Migrate task…'
    row.appendChild(label)

    const run = () => {
      destroy()
      migrateRun()
    }
    row.addEventListener('click', (evt) => {
      evt.preventDefault()
      evt.stopPropagation()
      run()
    })
    row.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault()
        run()
      }
    })
    panel.appendChild(row)
  }

  activeDocument.body.appendChild(panel)
  position(panel, opts.anchor)
  ;(selectedEl ?? firstFocusable)?.focus()

  // --- dismissal wiring -------------------------------------------
  // Listen on `mousedown` (not `click`): a picker opened from a
  // `mousedown` (live preview) would otherwise be torn down by the
  // very `click` that follows. Capture phase so an outside press on a
  // CodeMirror editor — which stops its own events — still reaches us.
  const onOutsidePointer = (evt: MouseEvent) => {
    if (evt.target instanceof Node && panel.contains(evt.target)) return
    destroy()
  }
  const onKey = (evt: KeyboardEvent) => {
    if (evt.key === 'Escape') {
      evt.preventDefault()
      destroy()
    }
  }
  const onViewport = () => position(panel, opts.anchor)

  function destroy() {
    activeDocument.removeEventListener('mousedown', onOutsidePointer, true)
    activeDocument.removeEventListener('contextmenu', onOutsidePointer, true)
    activeDocument.removeEventListener('keydown', onKey, true)
    activeDocument.removeEventListener('scroll', onViewport, true)
    activeWindow.removeEventListener('resize', onViewport)
    panel.remove()
    if (active && active.destroy === destroy) active = null
  }

  activeDocument.addEventListener('mousedown', onOutsidePointer, true)
  activeDocument.addEventListener('contextmenu', onOutsidePointer, true)
  activeDocument.addEventListener('keydown', onKey, true)
  activeDocument.addEventListener('scroll', onViewport, true)
  activeWindow.addEventListener('resize', onViewport)

  active = { destroy }
}

// Convenience for the disk-writer surfaces (reading view, sidebar, the
// in-note block): wires `onSelect` straight to `setTaskStatus`. Live
// preview deliberately skips this — its writes go through the open
// editor, not `vault.process` (see `document-task-live-preview.ts`).
// Pass `rawText` (the task's current line) to also offer the migrate
// action; omit it to render statuses only.
export function openStatusPickerForTarget(
  anchor: HTMLElement,
  target: TaskMutationTarget,
  model: TaskModel,
  app: App,
  rawText?: string
): void {
  openStatusPicker({
    anchor,
    model,
    currentStatus: target.status,
    onSelect: (id) => {
      // noinspection JSIgnoredPromiseFromCall
      void setTaskStatus(app, target, id, model)
    },
    migrateTarget:
      rawText !== undefined
        ? {
            sourceFile: target.sourceFile,
            sourceLine: target.sourceLine,
            rawText,
          }
        : undefined,
  })
}

// Anchor under the trigger, left-aligned, clamped into the viewport;
// flips above the trigger when there isn't room below (tasks near the
// bottom of a long note). Scroll-invariant by virtue of re-running on
// every viewport change rather than caching an offset.
function position(panel: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect()
  const pw = panel.offsetWidth
  const ph = panel.offsetHeight
  const vw = activeWindow.innerWidth
  const vh = activeWindow.innerHeight

  let left = rect.left
  if (left + pw > vw - MARGIN) left = vw - pw - MARGIN
  if (left < MARGIN) left = MARGIN

  let top = rect.bottom + GAP
  if (top + ph > vh - MARGIN) {
    const above = rect.top - GAP - ph
    top = above >= MARGIN ? above : Math.max(MARGIN, vh - ph - MARGIN)
  }

  panel.style.top = `${top}px`
  panel.style.left = `${left}px`
}
