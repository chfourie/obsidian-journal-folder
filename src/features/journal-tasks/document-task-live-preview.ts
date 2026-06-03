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

import { type App, Menu } from 'obsidian'
import { type Extension } from '@codemirror/state'
import {
  EditorView,
  type PluginValue,
  ViewPlugin,
} from '@codemirror/view'
import type { TaskStatusId } from '../../data-access'
import type { TaskModel } from './task-models'
import { setTaskStatus, type TaskMutationTarget } from './task-transition'
import { renderStatusIconById } from './render-status-icon'

export interface LivePreviewTaskContext {
  app: App
  resolveModel: () => TaskModel
  isEnabled: () => boolean
}

// Idempotency marker placed on every native checkbox we've already
// swapped (so a re-scan walks past it) and on every icon span we've
// inserted (so the disable path can find + remove them).
const SWAPPED_ATTR = 'data-jf-task-swapped'
const ICON_ATTR = 'data-jf-task-icon'

// Per-editor ViewPlugin — registered once via `registerEditorExtension`
// and instantiated by CodeMirror automatically for every editor that
// opens. Modelled after obsidian-tasks-group/obsidian-tasks'
// `LivePreviewExtension`: click handling lives on `view.dom`, the
// source mutation goes through `view.dispatch` (not `vault.process`),
// and `view.posAtDOM(target)` on the *native* checkbox is the only
// reliable way to map a DOM event back to a source position — our
// own injected spans aren't part of the source tree.
export function documentTaskLivePreviewExtension(
  ctx: LivePreviewTaskContext
): Extension {
  return ViewPlugin.define((view) => new LivePreviewPlugin(view, ctx))
}

class LivePreviewPlugin implements PluginValue {
  private readonly observer: MutationObserver
  private scanScheduled = false

  constructor(
    private readonly view: EditorView,
    private readonly ctx: LivePreviewTaskContext
  ) {
    this.onClick = this.onClick.bind(this)
    this.onContextMenu = this.onContextMenu.bind(this)
    // Capture-phase so we beat Obsidian's own checkbox click handler.
    this.view.dom.addEventListener('click', this.onClick, true)
    this.view.dom.addEventListener('contextmenu', this.onContextMenu, true)
    this.observer = new MutationObserver(() => this.scheduleScan())
    this.observer.observe(this.view.dom, { childList: true, subtree: true })
    this.scheduleScan()
  }

  destroy(): void {
    this.view.dom.removeEventListener('click', this.onClick, true)
    this.view.dom.removeEventListener('contextmenu', this.onContextMenu, true)
    this.observer.disconnect()
    this.restoreAll()
  }

  // ---------- click / context-menu --------------------------------

  private onClick(evt: MouseEvent): void {
    if (!this.ctx.isEnabled()) return
    const target = this.taskCheckboxTarget(evt.target)
    if (!target) return
    const mutation = this.mutationTargetFor(target)
    if (!mutation) return
    const model = this.ctx.resolveModel()
    evt.preventDefault()
    evt.stopPropagation()
    this.applyStatus(mutation, model.nextStatus(mutation.status), model)
  }

  private onContextMenu(evt: MouseEvent): void {
    if (!this.ctx.isEnabled()) return
    const target = this.taskCheckboxTarget(evt.target)
    if (!target) return
    const mutation = this.mutationTargetFor(target)
    if (!mutation) return
    const model = this.ctx.resolveModel()
    evt.preventDefault()
    evt.stopPropagation()
    const menu = new Menu()
    for (const status of model.statuses) {
      menu.addItem((item) => {
        item.setTitle(status.label)
        if (status.id === mutation.status) item.setIcon('check')
        item.onClick(() => this.applyStatus(mutation, status.id, model))
      })
    }
    menu.showAtMouseEvent(evt)
  }

  // Click events fire on either the hidden native input or our icon
  // span (which sits as the input's next sibling). Both resolve back
  // to the native input — that's the only element CodeMirror can map
  // to a source position with `posAtDOM`.
  private taskCheckboxTarget(eventTarget: EventTarget | null): HTMLInputElement | null {
    if (!(eventTarget instanceof Element)) return null
    if (
      eventTarget instanceof HTMLInputElement &&
      eventTarget.classList.contains('task-list-item-checkbox')
    ) {
      return eventTarget
    }
    if (
      eventTarget instanceof HTMLElement &&
      eventTarget.hasAttribute(ICON_ATTR)
    ) {
      const prev = eventTarget.previousElementSibling
      if (
        prev instanceof HTMLInputElement &&
        prev.classList.contains('task-list-item-checkbox')
      ) {
        return prev
      }
    }
    return null
  }

  private mutationTargetFor(
    input: HTMLInputElement
  ): TaskMutationTarget | null {
    const file = this.ctx.app.workspace.getActiveFile()
    if (!file) return null
    const pos = this.view.posAtDOM(input)
    const line = this.view.state.doc.lineAt(pos)
    const parsed = this.ctx.resolveModel().parseLine(line.text)
    if (!parsed) return null
    return {
      sourceFile: file,
      sourceLine: line.number - 1,
      status: parsed.status,
    }
  }

  // Writes the new status through a CodeMirror transaction so the
  // edit is immediate and stays inside the editor's own state
  // machine (no vault.process round-trip, no risk of the line-number
  // guard tripping because of an intervening external edit). The
  // sidebar / reading-view paths still use `setTaskStatus` via
  // vault.process — both surfaces converge on the same on-disk text.
  private applyStatus(
    target: TaskMutationTarget,
    nextStatus: TaskStatusId,
    model: TaskModel
  ): void {
    const line = this.view.state.doc.line(target.sourceLine + 1)
    const parsed = model.parseLine(line.text)
    if (!parsed || parsed.status !== target.status) {
      // Fall back to the disk-level path which surfaces a Notice on
      // mismatch — safer than blind-writing the wrong line.
      // noinspection JSIgnoredPromiseFromCall
      setTaskStatus(this.ctx.app, target, nextStatus, model)
      return
    }
    const replacement = model.serializeStatus(nextStatus)
    const updated = line.text.replace(/\[(.)\]/, replacement)
    this.view.dispatch(
      this.view.state.update({
        changes: { from: line.from, to: line.to, insert: updated },
      })
    )
  }

  // ---------- icon rendering --------------------------------------

  // Coalesce MutationObserver bursts into one rAF — Obsidian re-paints
  // the editor frequently during normal editing, but we only need a
  // single rescan per frame.
  private scheduleScan(): void {
    if (this.scanScheduled) return
    this.scanScheduled = true
    requestAnimationFrame(() => {
      this.scanScheduled = false
      this.scan()
    })
  }

  private scan(): void {
    if (!this.ctx.isEnabled()) {
      this.restoreAll()
      return
    }
    const inputs = this.view.dom.querySelectorAll<HTMLInputElement>(
      'input.task-list-item-checkbox'
    )
    inputs.forEach((input) => this.swapInput(input))
  }

  private swapInput(input: HTMLInputElement): void {
    const pos = this.view.posAtDOM(input)
    const line = this.view.state.doc.lineAt(pos)
    const model = this.ctx.resolveModel()
    const parsed = model.parseLine(line.text)
    const existing = input.nextElementSibling
    const hasIcon =
      input.hasAttribute(SWAPPED_ATTR) &&
      existing instanceof HTMLElement &&
      existing.hasAttribute(ICON_ATTR)

    // Per-status rendering: theme statuses leave the native checkbox
    // visible, plugin statuses swap it for our icon. The choice is
    // per row, so the same editor may contain both kinds of task.
    const rendering =
      (parsed &&
        model.statuses.find((s) => s.id === parsed.status)?.rendering) ??
      'plugin'

    if (!parsed || rendering === 'theme') {
      // Restore the native checkbox if we'd previously swapped it
      // (status was just edited from a plugin-rendered char to a
      // theme-rendered one).
      if (hasIcon) {
        existing!.remove()
        input.removeAttribute(SWAPPED_ATTR)
        input.style.display = ''
        input.removeAttribute('aria-hidden')
      }
      return
    }

    if (hasIcon) {
      // Already swapped — just refresh the icon (status / visuals
      // may have changed).
      existing!.setAttribute('aria-label', `Task status: ${parsed.status}`)
      renderStatusIconById(existing!, parsed.status, model)
      return
    }

    input.setAttribute(SWAPPED_ATTR, '')
    input.style.display = 'none'
    input.setAttribute('aria-hidden', 'true')
    input.after(this.buildIcon(parsed.status, model))
  }

  private buildIcon(
    statusId: TaskStatusId,
    model: TaskModel
  ): HTMLElement {
    const span = document.createElement('span')
    span.setAttribute(ICON_ATTR, '')
    span.setAttribute('role', 'button')
    span.setAttribute('tabindex', '0')
    span.setAttribute('aria-label', `Task status: ${statusId}`)
    renderStatusIconById(span, statusId, model)
    return span
  }

  private restoreAll(): void {
    this.view.dom
      .querySelectorAll<HTMLInputElement>(`input[${SWAPPED_ATTR}]`)
      .forEach((input) => {
        input.style.display = ''
        input.removeAttribute('aria-hidden')
        input.removeAttribute(SWAPPED_ATTR)
      })
    this.view.dom
      .querySelectorAll<HTMLElement>(`[${ICON_ATTR}]`)
      .forEach((icon) => icon.remove())
  }
}

// Plugin-instance ergonomics for the feature's lifecycle hooks: keeps
// a list of active LivePreviewPlugin instances so settings changes
// can rescan / restore without waiting for the next mutation. CM6
// doesn't expose a registry of live instances, so we maintain one
// here via the ViewPlugin's `eachView`-like iteration.
//
// Instead of trying to track instances by hand, the feature can
// simply call `app.workspace.iterateAllLeaves` and dispatch a no-op
// transaction on each editor; that re-triggers the plugin's
// scheduleScan via the MutationObserver naturally. See
// `JournalTasksFeature.useSettings` for the wiring.

