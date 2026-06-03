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
  TaskCheckboxStyle,
  TaskStatusId,
} from '../../data-access'
import type { TaskModel, TaskStatus } from './task-models'
import {
  cycleTaskStatus,
  type TaskMutationTarget,
} from './task-transition'
import {
  findDocumentTaskLines,
  type DocumentTaskLine,
} from './document-task-line-map'
import { showStatusMenuAt } from './document-task-menu'

export interface DocumentTasksContext {
  app: App
  // Lazy-resolved so the processor always sees the live model/style
  // even when settings change while a note is open.
  resolveModel: () => TaskModel
  resolveCheckboxStyle: () => TaskCheckboxStyle
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
  const taskLines = findDocumentTaskLines(
    section.text,
    section.lineStart,
    section.lineEnd,
    model
  )

  items.forEach((li, idx) => {
    const entry = taskLines[idx]
    if (!entry) return
    swapCheckbox(li, entry, sourceFile, model, checkboxStyle, context.app)
  })
}

function swapCheckbox(
  li: HTMLElement,
  entry: DocumentTaskLine,
  sourceFile: TFile,
  model: TaskModel,
  checkboxStyle: TaskCheckboxStyle,
  app: App
): void {
  const input = li.querySelector<HTMLInputElement>(
    'input.task-list-item-checkbox'
  )
  if (!input) return
  // Reuse the same target shape `task-transition` already understands —
  // no full `JournalTask` needed because the document view doesn't
  // know (or care about) the host note's tier.
  const target: TaskMutationTarget = {
    sourceFile,
    sourceLine: entry.line,
    status: entry.status,
  }
  const iconEl = document.createElement('span')
  iconEl.className = 'journal-folder-document-task-icon'
  iconEl.setAttribute('role', 'button')
  iconEl.setAttribute('tabindex', '0')
  iconEl.setAttribute('aria-label', `Task status: ${entry.status}`)
  // Mirror the data-task attribute Obsidian sets on the original
  // input so theme rules keyed on it still apply.
  iconEl.setAttribute('data-task', statusChar(model, entry.status))
  setIcon(iconEl, iconNameFor(model, entry.status, checkboxStyle))

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

  // Also update the parent `li`'s data-task so themes that style the
  // row (strikethrough on `[x]`, accent on `[/]`) continue to fire.
  li.setAttribute('data-task', statusChar(model, entry.status))
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
