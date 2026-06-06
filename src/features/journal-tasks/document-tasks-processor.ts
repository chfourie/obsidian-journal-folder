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
  type App,
  type MarkdownPostProcessorContext,
  TFile,
} from 'obsidian'
import type { TaskModel } from './task-models'
import {
  cycleTaskStatus,
  type TaskMutationTarget,
} from './task-transition'
import { findDocumentTaskLines } from './document-task-line-map'
import { openStatusPickerForTarget } from './status-picker-panel'
import { renderStatusIconById } from './render-status-icon'

export interface DocumentTasksContext {
  app: App
  // Lazy-resolved so the processor always sees the live model/style
  // even when settings change while a note is open. Rendering choice
  // sits at flow level (`TaskModel.rendering`) — one mode per flow.
  resolveModel: () => TaskModel
  isEnabled: () => boolean
}

// Markdown post-processor entry point — registered once at plugin
// load, gated at call-time by `isEnabled()` so flipping the setting
// off cancels the swap on the next render without unregistering.
// Reading view and live preview both call markdown post-processors
// (live preview re-renders chunks as the viewport changes), so a
// single registration covers both surfaces.
export function processDocumentTasks(
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  context: DocumentTasksContext
): void {
  if (!context.isEnabled()) return
  const items = Array.from(
    el.querySelectorAll<HTMLLIElement>('li.task-list-item')
  )
  if (items.length === 0) return
  const section = ctx.getSectionInfo(el)
  if (!section) return
  const sourceFile = context.app.vault.getAbstractFileByPath(ctx.sourcePath)
  if (!(sourceFile instanceof TFile)) return

  const model = context.resolveModel()
  const taskLines = findDocumentTaskLines(
    section.text,
    section.lineStart,
    section.lineEnd,
    model
  )
  // `getSectionInfo().text` is the whole file, so an absolute line index
  // is the raw task line — captured here for the picker's migrate action
  // (the migration writer re-checks the line on write, so a later edit
  // can't corrupt it).
  const docLines = section.text.split('\n')

  items.forEach((li, idx) => {
    const entry = taskLines[idx]
    if (!entry) return
    const target: TaskMutationTarget = {
      sourceFile,
      sourceLine: entry.line,
      status: entry.status,
    }
    const rawText = docLines[entry.line] ?? ''
    // Mirror the parsed status onto the parent li so themes that
    // style the row by attribute keep firing — even when our model
    // recognises a status Obsidian's default renderer doesn't (e.g.
    // `[/]`).
    const status = model.statuses.find((s) => s.id === entry.status)
    li.setAttribute('data-task', status?.char ?? ' ')
    // Flow-level rendering choice (theme = leave the native checkbox
    // alone, plugin = swap in our custom shell + icon).
    if (model.rendering === 'theme') {
      attachHandlersToNativeCheckbox(li, target, model, context.app, rawText)
    } else {
      swapCheckbox(li, target, model, context.app, rawText)
    }
  })
}

// Theme-mode path — Obsidian's native input stays visible (so the
// theme paints it however it wants), and we only attach the click /
// contextmenu handlers that route through the active TaskModel. A
// dataset marker keeps re-renders idempotent.
function attachHandlersToNativeCheckbox(
  li: HTMLElement,
  target: TaskMutationTarget,
  model: TaskModel,
  app: App,
  rawText: string
): void {
  const input = li.querySelector<HTMLInputElement>(
    'input.task-list-item-checkbox'
  )
  if (!input) return
  // Assigning to `onclick` / `oncontextmenu` replaces any handler from
  // a previous render. Using `addEventListener` with an idempotency
  // marker would leave the *first-render* `target` captured in the
  // closure — Obsidian's post-processor can re-run with the same input
  // node after a document edit, in which case the stale `sourceLine`
  // would write to the wrong row.
  input.onclick = (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    if (model.opensPickerOnClick(target.status)) {
      openStatusPickerForTarget(input, target, model, app, rawText)
      return
    }
    // noinspection JSIgnoredPromiseFromCall
    cycleTaskStatus(app, target, model)
  }
  input.oncontextmenu = (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    openStatusPickerForTarget(input, target, model, app, rawText)
  }
}

// Attribute markers keep the swap idempotent across Obsidian re-renders:
// the input persists (we don't remove it), so without a marker a re-run
// would stack a second icon.
const DOC_SWAPPED_ATTR = 'data-jf-doc-swapped'
const DOC_ICON_ATTR = 'data-jf-doc-icon'

function swapCheckbox(
  li: HTMLElement,
  target: TaskMutationTarget,
  model: TaskModel,
  app: App,
  rawText: string
): void {
  const input = li.querySelector<HTMLInputElement>(
    'input.task-list-item-checkbox'
  )
  if (!input) return

  // Rebuild from the freshly parsed status: drop the icon we added on a
  // previous render (status / model may have changed since).
  const existing = input.nextElementSibling
  if (existing instanceof HTMLElement && existing.hasAttribute(DOC_ICON_ATTR)) {
    existing.remove()
  }

  const iconEl = document.createElement('span')
  iconEl.setAttribute(DOC_ICON_ATTR, '')
  iconEl.setAttribute('role', 'button')
  iconEl.setAttribute('tabindex', '0')
  iconEl.setAttribute('aria-label', `Task status: ${target.status}`)
  renderStatusIconById(iconEl, target.status, model)
  // Marks a document-body task icon (vs a sidebar/panel one) so CSS
  // overlays it onto the kept native checkbox.
  iconEl.classList.add('jf-doc-task-status')

  iconEl.addEventListener('click', (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    if (model.opensPickerOnClick(target.status)) {
      openStatusPickerForTarget(iconEl, target, model, app, rawText)
      return
    }
    // noinspection JSIgnoredPromiseFromCall
    cycleTaskStatus(app, target, model)
  })
  iconEl.addEventListener('contextmenu', (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    openStatusPickerForTarget(iconEl, target, model, app, rawText)
  })
  iconEl.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault()
      if (model.opensPickerOnClick(target.status)) {
        openStatusPickerForTarget(iconEl, target, model, app, rawText)
        return
      }
      // noinspection JSIgnoredPromiseFromCall
      cycleTaskStatus(app, target, model)
    }
  })

  // Keep the native checkbox in normal flow so the theme's own layout
  // positions it (margin / indent — whatever the theme uses); just hide
  // it and route interaction to the icon, which is overlaid on top via a
  // negative margin (see styles.css `.jf-doc-task-status`). This makes
  // the icon land exactly where the theme draws the checkbox, without
  // measuring or re-deriving per-theme geometry. `opacity: 0` hides the
  // whole element (border, fill, and any ::before/::after check glyph) so
  // nothing bleeds through. Themes that take the checkbox OUT of flow
  // (absolute / transform) aren't covered — use Theme-checkbox rendering
  // for those.
  input.setAttribute(DOC_SWAPPED_ATTR, '')
  input.setAttribute('aria-hidden', 'true')
  input.style.opacity = '0'
  input.style.pointerEvents = 'none'
  input.style.marginInlineEnd = '0'
  input.after(iconEl)
}
