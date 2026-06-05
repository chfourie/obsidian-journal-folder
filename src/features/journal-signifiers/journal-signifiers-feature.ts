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

import { type Editor, MarkdownView, Plugin } from 'obsidian'
import {
  type JournalFolderSettings,
  PluginFeature,
} from '../../data-access'
import { processSignifiers } from './process-signifiers'
import {
  clearAllReadingReserve,
  repositionAllReadingGutters,
  scheduleReadingGutters,
} from './gutter-positioner'
import { signifierLivePreviewExtension } from './signifier-live-preview'
import { computeSignifierLineEdit } from './signifier-line-edit'
import { SignifierPickerModal } from './signifier-picker-modal'

// Feature that renders signifiers (tag → icon) and lets the user edit the
// signifiers on the current line. Signifiers are general — they apply to
// any rendered markdown, not just tasks — so they live in their own
// feature rather than inside the tasks feature. All signifier settings are
// global, so this feature reads `globalSettings` everywhere.
export class JournalSignifiersFeature extends PluginFeature {
  constructor(plugin: Plugin) {
    super(plugin)
  }

  async load(): Promise<void> {
    // Recompute gutter positions + reserve for the active margin placement
    // (no-ops for the flow placements).
    const recompute = () =>
      repositionAllReadingGutters(
        this.globalSettings.signifierPlacement,
        this.globalSettings.signifierReserveGutter
      )

    // A sizer's WIDTH changes on readable-line-width toggle, window resize and
    // sidebar toggle — none of which reliably fire a workspace event we can
    // catch — and the RESERVE depends on that width (the pane's clip edge). So
    // a ResizeObserver on each rendered sizer is the robust re-measure trigger.
    // Observe the BORDER box: our own `padding-inline-start` leaves it
    // unchanged, so the reserve can't feed back into an observer loop.
    const observed = new WeakSet<Element>()
    const sizerObserver = new ResizeObserver(() => recompute())
    this.plugin.register(() => sizerObserver.disconnect())

    // Reading-view rendering: replace / annotate configured tags with
    // their signifier icon. Independent of tasks.
    this.plugin.registerMarkdownPostProcessor((el) => {
      processSignifiers(el, this.globalSettings)
      // Margin (gutter) placements are positioned by measurement, not CSS
      // constants. Schedule a batched pass over the whole rendered note (the
      // single-column anchor needs every marker, not just this section).
      const placement = this.globalSettings.signifierPlacement
      if (placement === 'margin' || placement === 'margin-column') {
        const container = el.closest<HTMLElement>('.markdown-preview-sizer') ?? el
        scheduleReadingGutters(
          container,
          placement,
          this.globalSettings.signifierReserveGutter
        )
        if (!observed.has(container)) {
          observed.add(container)
          sizerObserver.observe(container, { box: 'border-box' })
        }
      }
    })

    // Theme changes (`css-change`) can shift bullet / icon metrics WITHOUT
    // resizing the sizer, and navigation can restore a cached preview without
    // re-running the post-processor (`active-leaf-change` on pane switch,
    // `file-open` for in-leaf link / back navigation, `layout-change`). Size
    // changes themselves are covered by the ResizeObserver above.
    const ws = this.plugin.app.workspace
    this.plugin.registerEvent(ws.on('css-change', recompute))
    this.plugin.registerEvent(ws.on('active-leaf-change', recompute))
    this.plugin.registerEvent(ws.on('layout-change', recompute))
    this.plugin.registerEvent(ws.on('file-open', recompute))

    // Live-preview (editing-view) rendering via a stable CodeMirror
    // decoration. Gated internally on `signifierLivePreviewEnabled`; the
    // kill-switch means a settings change can disable it instantly (see
    // `useSettings`, which re-applies editor extensions).
    this.plugin.registerEditorExtension(
      signifierLivePreviewExtension({
        getSettings: () => this.globalSettings,
      })
    )

    // Keyboard / command-palette entry: add or remove signifiers on the
    // cursor line without typing tags. Mirrors the tasks feature's
    // line-oriented editor commands.
    this.plugin.addCommand({
      id: 'modify-signifiers-on-line',
      name: 'Modify signifiers on current line…',
      editorCallback: (editor) => this.openPicker(editor),
    })

    // Right-click context-menu equivalent of the command.
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('editor-menu', (menu, editor, view) => {
        if (!(view instanceof MarkdownView)) return
        if (this.globalSettings.signifiers.length === 0) return
        menu.addItem((item) => {
          item.setTitle('Modify signifiers on line…')
          item.setIcon('star')
          item.onClick(() => this.openPicker(editor))
        })
      })
    )
  }

  // Opens the multi-select picker pre-checked with the signifiers already
  // on the cursor line, then writes the recomputed line back through the
  // editor (so the change lands in the editor's own state machine and
  // survives live-preview reconciliation).
  private openPicker(editor: Editor): void {
    const signifiers = this.globalSettings.signifiers
    if (signifiers.length === 0) return
    const cursor = editor.getCursor()
    const original = editor.getLine(cursor.line)
    new SignifierPickerModal(this.plugin.app, signifiers, original, (ids) => {
      const updated = computeSignifierLineEdit(original, signifiers, ids)
      if (updated === original) return
      editor.setLine(cursor.line, updated)
      const delta = updated.length - original.length
      if (delta !== 0) {
        editor.setCursor({
          line: cursor.line,
          ch: Math.max(0, cursor.ch + delta),
        })
      }
    }).open()
  }

  useSettings(settings: JournalFolderSettings): void {
    super.useSettings(settings)
    // Re-apply editor extensions across open editors so signifier edits
    // and the live-preview kill-switch take effect immediately.
    this.plugin.app.workspace.updateOptions?.()
    // Leaving the margin modes must drop the reserved left lane (the
    // re-render below rebuilds content but the container keeps our inline
    // padding); margin modes re-apply it through the positioning pass.
    const placement = settings.signifierPlacement
    if (placement !== 'margin' && placement !== 'margin-column') {
      clearAllReadingReserve()
    }
    // Reading-view markdown post-processors do NOT re-run on a settings
    // change, so a placement / signifier edit would otherwise leave the
    // previously-rendered markers in place (e.g. switching gutter→start
    // would keep showing the gutter). Force open reading views to
    // re-render so the new placement is applied to fresh DOM.
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view
      if (view instanceof MarkdownView) {
        // `previewMode.rerender(true)` is the sanctioned full re-render
        // (semi-private in the typings). No-op when not in reading mode.
        const preview = (view as unknown as {
          previewMode?: { rerender?: (full?: boolean) => void }
        }).previewMode
        preview?.rerender?.(true)
      }
    })
  }
}
