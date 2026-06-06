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
    //
    // CRITICAL — observe only WIDTH, not height: writing our reserve
    // `padding-inline-start` narrows the content, which reflows it TALLER, which
    // changes the sizer's border-box HEIGHT — re-firing this observer and
    // feeding back into an endless recompute → write → reflow loop (seen as the
    // whole view flickering on/off). The reserve depends solely on width, so we
    // track each sizer's border-box inline size and recompute ONLY when it
    // actually changes. Our padding write never changes border-box width, so it
    // can't re-trigger us — the loop is broken at the source.
    //
    // DEBOUNCED (trailing): a width drag fires the observer every frame; the
    // icon `left`s are host-relative (invariant to resize / re-centering), so
    // only the reserve needs recomputing — once, after the drag settles.
    const observed = new WeakSet<Element>()
    const lastWidth = new WeakMap<Element, number>()
    let resizeDebounce = 0
    const sizerObserver = new ResizeObserver((entries) => {
      let widthChanged = false
      for (const entry of entries) {
        const width =
          entry.borderBoxSize?.[0]?.inlineSize ??
          (entry.target as HTMLElement).getBoundingClientRect().width
        const prev = lastWidth.get(entry.target)
        if (prev === undefined || Math.abs(prev - width) > 0.5) {
          lastWidth.set(entry.target, width)
          widthChanged = true
        }
      }
      if (!widthChanged) return
      if (resizeDebounce) window.clearTimeout(resizeDebounce)
      resizeDebounce = window.setTimeout(() => {
        resizeDebounce = 0
        recompute()
      }, 150)
    })
    this.plugin.register(() => {
      if (resizeDebounce) window.clearTimeout(resizeDebounce)
      sizerObserver.disconnect()
      // Strip any reserve we applied so a later reload (or disabling the
      // plugin) starts from the theme's own padding — never a stale inflated
      // value that a fresh measurement would then read back as the base.
      clearAllReadingReserve()
    })

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

    // Live-preview (editing-view) rendering via a CodeMirror decoration:
    // always on, gutter-positioned, optionally hiding the matched tag
    // (`signifierHideTagInLivePreview`). A settings change re-applies editor
    // extensions instantly (see `useSettings`, which calls `updateOptions`).
    this.plugin.registerEditorExtension(
      signifierLivePreviewExtension({
        getSettings: () => this.globalSettings,
        app: this.plugin.app,
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
    // Re-apply editor extensions across open editors so signifier / placement
    // / tag-hiding edits take effect in live preview immediately.
    this.plugin.app.workspace.updateOptions?.()
    // Turning the reserved-lane toggle off must drop the inline padding the
    // positioning pass left on the container; with it on, the pass re-applies
    // the (possibly zero) deficit on the re-render below.
    if (!settings.signifierReserveGutter) {
      clearAllReadingReserve()
    }
    // Reading-view markdown post-processors do NOT re-run on a settings
    // change, so a placement / signifier / tag-hiding edit would otherwise
    // leave the previously-rendered markers in place. Force open reading
    // views to re-render so the new settings apply to fresh DOM.
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
