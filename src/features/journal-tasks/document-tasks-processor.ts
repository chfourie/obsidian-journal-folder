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
import { showStatusMenuAt } from './document-task-menu'
import { renderStatusIconById } from './render-status-icon'

export interface DocumentTasksContext {
  app: App
  // Lazy-resolved so the processor always sees the live model/style
  // even when settings change while a note is open. Rendering choice
  // is read per-status off the model (each `TaskStatus.rendering`)
  // — there's no global rendering switch.
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

  items.forEach((li, idx) => {
    const entry = taskLines[idx]
    if (!entry) return
    const target: TaskMutationTarget = {
      sourceFile,
      sourceLine: entry.line,
      status: entry.status,
    }
    // Mirror the parsed status onto the parent li so themes that
    // style the row by attribute keep firing — even when our model
    // recognises a status Obsidian's default renderer doesn't (e.g.
    // `[/]`).
    const status = model.statuses.find((s) => s.id === entry.status)
    li.setAttribute('data-task', status?.char ?? ' ')
    // Per-status rendering choice (theme = leave the native checkbox
    // alone, plugin = swap in our custom shell + icon).
    const rendering = status?.rendering ?? 'plugin'
    if (rendering === 'theme') {
      attachHandlersToNativeCheckbox(li, target, model, context.app)
    } else {
      swapCheckbox(li, target, model, context.app)
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
  app: App
): void {
  const input = li.querySelector<HTMLInputElement>(
    'input.task-list-item-checkbox'
  )
  if (!input) return
  if (input.dataset.jfTaskHandled === '1') return
  input.dataset.jfTaskHandled = '1'
  input.addEventListener('click', (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    // noinspection JSIgnoredPromiseFromCall
    cycleTaskStatus(app, target, model)
  })
  input.addEventListener('contextmenu', (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    showStatusMenuAt(evt, target, model, app)
  })
}

function swapCheckbox(
  li: HTMLElement,
  target: TaskMutationTarget,
  model: TaskModel,
  app: App
): void {
  const input = li.querySelector<HTMLInputElement>(
    'input.task-list-item-checkbox'
  )
  if (!input) return
  const iconEl = document.createElement('span')
  iconEl.setAttribute('role', 'button')
  iconEl.setAttribute('tabindex', '0')
  iconEl.setAttribute('aria-label', `Task status: ${target.status}`)
  renderStatusIconById(iconEl, target.status, model)

  iconEl.addEventListener('click', (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    // noinspection JSIgnoredPromiseFromCall
    cycleTaskStatus(app, target, model)
  })
  iconEl.addEventListener('contextmenu', (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    showStatusMenuAt(evt, target, model, app)
  })
  iconEl.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault()
      // noinspection JSIgnoredPromiseFromCall
      cycleTaskStatus(app, target, model)
    }
  })

  input.replaceWith(iconEl)
}
