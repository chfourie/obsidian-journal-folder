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

import { type App, type Editor, MarkdownView } from 'obsidian'
import { type Extension } from '@codemirror/state'
import { EditorView, type PluginValue, ViewPlugin } from '@codemirror/view'
import type { TaskStatusId } from '../../data-access'
import type { TaskModel } from './task-models'
import { setTaskStatus, type TaskMutationTarget } from './task-transition'
import { openStatusPicker } from './status-picker-panel'
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
// Cached on the icon so a re-scan can tell whether the icon already
// reflects the current parsed status + model. Without this check every
// scan would remove and re-append the icon, and that DOM mutation would
// re-trigger the MutationObserver — a self-feeding rescan loop.
const ICON_STATUS_ATTR = 'data-jf-icon-status'
const ICON_MODEL_ATTR = 'data-jf-icon-model'

// Per-editor ViewPlugin — registered once via `registerEditorExtension`
// and instantiated by CodeMirror automatically for every editor that
// opens. Status cycling is driven from `mousedown` on `view.dom` (the
// trailing `click` is swallowed so Obsidian's native checkbox toggle
// can't undo the write); the source line is located via
// `view.posAtDOM` on the *native* checkbox (our injected icon isn't
// part of the source tree); and the edit is committed through
// Obsidian's `Editor` API — see `applyStatus` for why a raw
// `view.dispatch` / `vault.process` write doesn't stick in live
// preview.
export function documentTaskLivePreviewExtension(
  ctx: LivePreviewTaskContext
): Extension {
  return ViewPlugin.define((view) => new LivePreviewPlugin(view, ctx))
}

class LivePreviewPlugin implements PluginValue {
  private readonly observer: MutationObserver
  private scanScheduled = false
  // Set when we handle a status-cycling mousedown, consumed by the
  // click handler. We cycle on `mousedown`, but the browser still
  // fires the matching `click` afterwards, and Obsidian's native
  // checkbox handler toggles our freshly-written status straight back.
  // Swallowing that one click is what makes the change stick.
  private suppressClick = false

  constructor(
    private readonly view: EditorView,
    private readonly ctx: LivePreviewTaskContext
  ) {
    // We cycle on `mousedown`, not `click`: capture-phase so we run
    // before CM's own pointer handling and can cancel the editor's
    // default (caret placement / widget selection). The paired `click`
    // listener then swallows the trailing click so Obsidian's native
    // checkbox toggle doesn't undo the write. There is intentionally no
    // keyboard handler: in the live-preview editor Enter/Space/Tab are
    // text-editing keys, so keyboard users cycle a status by editing the
    // `[ ]` character directly — the icon is a mouse affordance only.
    this.view.dom.addEventListener('mousedown', this.onMouseDown, true)
    this.view.dom.addEventListener('click', this.onClick, true)
    this.view.dom.addEventListener('contextmenu', this.onContextMenu, true)
    this.observer = new MutationObserver(() => this.scheduleScan())
    this.observer.observe(this.view.dom, { childList: true, subtree: true })
    this.scheduleScan()
  }

  destroy(): void {
    this.view.dom.removeEventListener('mousedown', this.onMouseDown, true)
    this.view.dom.removeEventListener('click', this.onClick, true)
    this.view.dom.removeEventListener('contextmenu', this.onContextMenu, true)
    this.observer.disconnect()
    this.restoreAll()
  }

  // Swallows the single `click` that follows a status-cycling
  // `mousedown` so Obsidian's native checkbox handler can't toggle the
  // status we just wrote.
  // Arrow-bound so it can be added/removed as an event listener with a
  // stable `this`.
  private onClick = (evt: MouseEvent): void => {
    if (!this.suppressClick) return
    this.suppressClick = false
    evt.preventDefault()
    evt.stopPropagation()
  }

  // ---------- pointer / context-menu ------------------------------

  private onMouseDown = (evt: MouseEvent): void => {
    // Fresh per pointer interaction — re-armed below only when we
    // actually handle a cycle, so a `mousedown` with no following
    // `click` (e.g. a drag) can't leave the suppressor latched and
    // swallow some later, unrelated click. Every `click` is preceded
    // by its own `mousedown`, so this stays in step.
    this.suppressClick = false
    // Primary button only — right-click is handled by `onContextMenu`,
    // middle/aux clicks shouldn't cycle.
    if (evt.button !== 0) return
    if (!this.ctx.isEnabled()) return
    const input = this.taskCheckboxTarget(evt.target)
    if (!input) return
    const mutation = this.mutationTargetFor(input)
    if (!mutation) return
    // Cancel the editor's own pointer default (caret placement / widget
    // selection) and stop the event before CM sees it. Arm the click
    // suppressor so the trailing click can't trigger a native toggle.
    evt.preventDefault()
    evt.stopPropagation()
    this.suppressClick = true
    const model = this.ctx.resolveModel()
    // A self-cycling status opens the picker; everything else advances.
    if (model.opensPickerOnClick(mutation.status)) {
      this.openPicker(input, mutation, model)
      return
    }
    this.applyStatus(mutation, model.nextStatus(mutation.status), model)
  }

  private onContextMenu = (evt: MouseEvent): void => {
    if (!this.ctx.isEnabled()) return
    const input = this.taskCheckboxTarget(evt.target)
    if (!input) return
    const mutation = this.mutationTargetFor(input)
    if (!mutation) return
    evt.preventDefault()
    evt.stopPropagation()
    this.openPicker(input, mutation, this.ctx.resolveModel())
  }

  // Opens the in-house status picker anchored under the visible icon.
  // Status selection routes through `applyStatus` — the live editor
  // write path, not `vault.process`, which the open buffer would revert.
  // The migrate action reads the task's current line text so the picker
  // can offer "Migrate task…" for active tasks in journal notes.
  private openPicker(
    input: HTMLInputElement,
    mutation: TaskMutationTarget,
    model: TaskModel
  ): void {
    const rawText = this.view.state.doc.lineAt(
      this.view.posAtDOM(input)
    ).text
    openStatusPicker({
      anchor: this.anchorFor(input),
      model,
      currentStatus: mutation.status,
      onSelect: (id) => this.applyStatus(mutation, id, model),
      migrateTarget: {
        sourceFile: mutation.sourceFile,
        sourceLine: mutation.sourceLine,
        rawText,
      },
    })
  }

  // The native checkbox is `display:none` under plugin rendering, so it
  // has no on-screen rect to anchor a panel to — prefer our visible
  // icon (its next sibling) and fall back to the input only in theme
  // rendering, where the input itself is what's shown.
  private anchorFor(input: HTMLInputElement): HTMLElement {
    const next = input.nextElementSibling
    if (next instanceof HTMLElement && next.hasAttribute(ICON_ATTR)) return next
    return input
  }

  // Pointer events land on either the hidden native input or our icon
  // span (which sits as the input's next sibling). Both resolve back
  // to the native input — that's the only element CodeMirror can map
  // to a source position with `posAtDOM`.
  private taskCheckboxTarget(
    eventTarget: EventTarget | null
  ): HTMLInputElement | null {
    if (!(eventTarget instanceof Element)) return null
    if (
      eventTarget.instanceOf(HTMLInputElement) &&
      eventTarget.classList.contains('task-list-item-checkbox')
    ) {
      return eventTarget
    }
    // Walk up to the icon span — clicks land on a Lucide SVG, an
    // emoji glyph, or the inner `.jf-task-status-icon` wrapper, none
    // of which carry `ICON_ATTR` themselves.
    const icon = eventTarget.closest<HTMLElement>(`[${ICON_ATTR}]`)
    if (!icon) return null
    const prev = icon.previousElementSibling
    if (
      prev instanceof HTMLInputElement &&
      prev.classList.contains('task-list-item-checkbox') &&
      prev.hasAttribute(SWAPPED_ATTR)
    ) {
      return prev
    }
    // Orphan icon (the input we used to sit next to is gone). Drop it
    // rather than routing the click to a neighbour — that's how the
    // "wrong task got toggled" bug shows up after rapid edit/preview
    // mode switches.
    icon.remove()
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

  // Writes the new status. When the task lives in the note that's open
  // in the active editor (the live-preview case), the edit MUST go
  // through Obsidian's `Editor` API: the open document's editor buffer
  // is authoritative, so a `vault.process` disk write is immediately
  // reverted by the editor re-syncing the file, and a raw CodeMirror
  // `view.dispatch` is filtered out by Obsidian's widget reconciler.
  // `editor.setLine` is the sanctioned path and commits cleanly. For
  // anything else (no live editor, a different file, or a line that has
  // since drifted) we fall back to the disk writer that the reading-
  // view and sidebar surfaces use — it guards the line and surfaces a
  // Notice on mismatch.
  private applyStatus(
    target: TaskMutationTarget,
    nextStatus: TaskStatusId,
    model: TaskModel
  ): void {
    const editor = this.editorForThisView()
    if (editor) {
      const lineText = editor.getLine(target.sourceLine)
      const parsed = model.parseLine(lineText)
      if (parsed && parsed.status === target.status) {
        const updated = lineText.replace(
          /\[(.)\]/,
          model.serializeStatus(nextStatus)
        )
        editor.setLine(target.sourceLine, updated)
        // `setLine` often updates the line in place without a childList
        // mutation, so the MutationObserver won't fire — repaint the
        // icon for the new status proactively.
        this.scheduleScan()
        return
      }
    }
    // noinspection JSIgnoredPromiseFromCall
    void setTaskStatus(this.ctx.app, target, nextStatus, model)
  }

  // Finds the Obsidian `Editor` whose underlying CodeMirror `EditorView`
  // is exactly the one this ViewPlugin (and thus the click) belongs to.
  // `getActiveViewOfType` is unreliable here: the same note can be open
  // in more than one editor instance, and the *active* one may not be
  // the one that was clicked — editing it changes a buffer the user
  // can't see while their visible copy (and the file) stay untouched.
  private editorForThisView(): Editor | null {
    let found: Editor | null = null
    this.ctx.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view
      if (
        view instanceof MarkdownView &&
        // @ts-ignore — `editor.cm` is the CM6 EditorView backing the
        // Obsidian Editor (undocumented but stable).
        view.editor?.cm === this.view
      ) {
        found = view.editor
      }
    })
    return found
  }

  // ---------- icon rendering --------------------------------------

  // Coalesce MutationObserver bursts into one rAF — Obsidian re-paints
  // the editor frequently during normal editing, but we only need a
  // single rescan per frame.
  private scheduleScan(): void {
    if (this.scanScheduled) return
    this.scanScheduled = true
    window.requestAnimationFrame(() => {
      this.scanScheduled = false
      this.scan()
    })
  }

  private scan(): void {
    if (!this.ctx.isEnabled()) {
      this.restoreAll()
      return
    }

    // CodeMirror reuses / rebuilds DOM nodes as the document changes,
    // which can leave our injected icons paired with the *wrong*
    // input (or no input at all) after a status edit followed by a
    // mode switch. If we don't notice, clicking the icon routes
    // through `posAtDOM` of the wrong input and we write to a
    // different task line. Sweep orphans before swapping so every
    // icon that survives the scan is guaranteed to sit right after
    // a real task checkbox.
    this.view.dom
      .querySelectorAll<HTMLElement>(`[${ICON_ATTR}]`)
      .forEach((icon) => {
        const prev = icon.previousElementSibling
        const ownerOk =
          prev instanceof HTMLInputElement &&
          prev.classList.contains('task-list-item-checkbox') &&
          prev.hasAttribute(SWAPPED_ATTR)
        if (!ownerOk) icon.remove()
      })

    // Also clear `SWAPPED_ATTR` on inputs whose paired icon is gone —
    // either the orphan sweep above removed it, or CodeMirror dropped
    // it during a re-render. Without this, `swapInput` sees the marker
    // and skips re-installing, leaving an invisible (display: none)
    // input the user can't interact with.
    this.view.dom
      .querySelectorAll<HTMLInputElement>(`input[${SWAPPED_ATTR}]`)
      .forEach((input) => {
        const next = input.nextElementSibling
        const hasIcon =
          next instanceof HTMLElement && next.hasAttribute(ICON_ATTR)
        if (!hasIcon) {
          input.removeAttribute(SWAPPED_ATTR)
          input.removeAttribute('aria-hidden')
        }
      })

    const inputs = this.view.dom.querySelectorAll<HTMLInputElement>(
      'input.task-list-item-checkbox'
    )
    // One model resolution per scan pass — `resolveModel` builds maps +
    // closures, so calling it per checkbox per MutationObserver burst
    // added avoidable allocation churn.
    const model = this.ctx.resolveModel()
    inputs.forEach((input) => this.swapInput(input, model))
  }

  private swapInput(input: HTMLInputElement, model: TaskModel): void {
    const pos = this.view.posAtDOM(input)
    const line = this.view.state.doc.lineAt(pos)
    const parsed = model.parseLine(line.text)

    const existing = input.nextElementSibling
    const existingIcon =
      existing instanceof HTMLElement && existing.hasAttribute(ICON_ATTR)
        ? existing
        : null

    // Flow-level rendering: when the active flow's rendering is
    // `'theme'`, the native checkbox stays visible so the active
    // theme styles it; for `'plugin'` we swap in our shell + icon.
    if (!parsed || model.rendering === 'theme') {
      // Restore the native checkbox if we'd previously swapped it
      // (status was just edited from a plugin-rendered char to a
      // theme-rendered one).
      if (existingIcon) existingIcon.remove()
      if (input.hasAttribute(SWAPPED_ATTR)) {
        input.removeAttribute(SWAPPED_ATTR)
        input.removeAttribute('aria-hidden')
      }
      return
    }

    // Idempotency guard: if an icon already reflects this exact status +
    // model, leave the DOM untouched. Rebuilding it unconditionally was
    // a mutation on every scan, and each mutation woke the
    // MutationObserver, which scheduled another scan — a self-feeding
    // loop that pegged a core and tore the icon out from under the
    // pointer between mousedown and mouseup (so the browser never
    // synthesised a click). Only rebuild when the parsed status or the
    // active model actually changed.
    if (
      existingIcon &&
      existingIcon.getAttribute(ICON_STATUS_ATTR) === parsed.status &&
      existingIcon.getAttribute(ICON_MODEL_ATTR) === model.id &&
      input.hasAttribute(SWAPPED_ATTR)
    ) {
      return
    }

    if (existingIcon) existingIcon.remove()
    input.setAttribute(SWAPPED_ATTR, '')
    input.setAttribute('aria-hidden', 'true')
    const icon = this.buildIcon(parsed.status, model)
    icon.setAttribute(ICON_STATUS_ATTR, parsed.status)
    icon.setAttribute(ICON_MODEL_ATTR, model.id)
    input.after(icon)
  }

  private buildIcon(statusId: TaskStatusId, model: TaskModel): HTMLElement {
    const span = activeDocument.createElement('span')
    span.setAttribute(ICON_ATTR, '')
    // Purely decorative: a mouse affordance only, so it's `aria-hidden`
    // and not focusable. It deliberately does NOT carry `role="button"`
    // / `tabindex` (unlike the reading-view icon): inside the live-
    // preview editor Enter/Space/Tab are text-editing keys, so it can't
    // be a real keyboard target. Keyboard users cycle the status by
    // editing the `[ ]` character in the source line; screen readers
    // read that source text rather than this redundant glyph.
    span.setAttribute('aria-hidden', 'true')
    renderStatusIconById(span, statusId, model)
    // NOTE: deliberately NOT tagged `jf-doc-task-status`. In live preview
    // the icon is appended after the (hidden) native checkbox and
    // CodeMirror already positions it correctly in the marker area —
    // adding the reading-view margin pull would shove it too far left.
    return span
  }

  private restoreAll(): void {
    this.view.dom
      .querySelectorAll<HTMLInputElement>(`input[${SWAPPED_ATTR}]`)
      .forEach((input) => {
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
