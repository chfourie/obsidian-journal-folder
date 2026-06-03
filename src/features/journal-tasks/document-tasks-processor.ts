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
  setIcon,
  TFile,
} from 'obsidian'
import type {
  TaskCheckboxRendering,
  TaskCheckboxStyle,
  TaskStatusId,
} from '../../data-access'
import type { TaskModel, TaskStatus } from './task-models'
import {
  cycleTaskStatus,
  type TaskMutationTarget,
} from './task-transition'
import { findDocumentTaskLines } from './document-task-line-map'
import { showStatusMenuAt } from './document-task-menu'

export interface DocumentTasksContext {
  app: App
  // Lazy-resolved so the processor always sees the live model/style
  // even when settings change while a note is open.
  resolveModel: () => TaskModel
  resolveCheckboxStyle: () => TaskCheckboxStyle
  resolveRendering: () => TaskCheckboxRendering
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
  const checkboxStyle = context.resolveCheckboxStyle()
  const rendering = context.resolveRendering()
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
    // Always mirror the parsed status onto the parent li's data-task
    // so themes that style the row by attribute keep firing — even
    // when our model recognises a status Obsidian's default renderer
    // doesn't (e.g. `[/]`).
    li.setAttribute('data-task', statusChar(model, entry.status))
    if (rendering === 'theme') {
      attachHandlersToNativeCheckbox(li, target, model, context.app)
    } else {
      swapCheckbox(li, target, model, checkboxStyle, context.app)
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
  checkboxStyle: TaskCheckboxStyle,
  app: App
): void {
  const input = li.querySelector<HTMLInputElement>(
    'input.task-list-item-checkbox'
  )
  if (!input) return
  const iconEl = document.createElement('span')
  iconEl.className = 'journal-folder-document-task-icon'
  iconEl.setAttribute('role', 'button')
  iconEl.setAttribute('tabindex', '0')
  iconEl.setAttribute('aria-label', `Task status: ${target.status}`)
  iconEl.setAttribute('data-task', statusChar(model, target.status))
  setIcon(iconEl, iconNameFor(model, target.status, checkboxStyle))

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

function iconNameFor(
  model: TaskModel,
  statusId: TaskStatusId,
  checkboxStyle: TaskCheckboxStyle
): string {
  const status = findStatus(model, statusId)
  if (!status) return checkboxStyle === 'circle' ? 'circle' : 'square'
  return checkboxStyle === 'circle' ? status.iconCircle : status.iconSquare
}

function statusChar(model: TaskModel, statusId: TaskStatusId): string {
  const status = findStatus(model, statusId)
  return status?.char ?? ' '
}

function findStatus(
  model: TaskModel,
  statusId: TaskStatusId
): TaskStatus | undefined {
  return model.statuses.find((s) => s.id === statusId)
}
