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
  MarkdownRenderChild,
  MarkdownView,
  type Plugin,
  TFile,
} from 'obsidian'
import { mount, unmount } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'
import {
  isJournalFileBasename,
  type JournalFolderSettings,
  type JournalNote,
  type JournalTask,
  journalNoteFactoryWithSettings,
  PluginFeature,
} from '../../data-access'
import { ErrorMessage } from '../../ui'
import TaskList from './TaskList.svelte'
import { TaskCache } from './task-cache'
import { resolveTaskModel } from './task-models'
import { parseJournalTasksBlock } from './parse-block-config'
import { buildReferenceRange } from './reference-range'
import { effectiveUnits, findTaskCandidates } from './task-scope'
import { sortTasks } from './task-sorting'
import { processDocumentTasks } from './document-tasks-processor'
import { documentTaskLivePreviewExtension } from './document-task-live-preview'
import { appendStatusMenuItems } from './document-task-menu'

export class JournalTasksFeature extends PluginFeature {
  readonly #cache: TaskCache

  constructor(plugin: Plugin) {
    super(plugin)
    this.#cache = new TaskCache(plugin.app)
  }

  // Public accessor so the sidebar feature can reuse a single cache
  // across its panel and the in-note code block — keeps the cache
  // hit-rate healthy when the user has both surfaces visible.
  get cache(): TaskCache {
    return this.#cache
  }

  async load(): Promise<void> {
    this.plugin.registerEvent(
      this.plugin.app.vault.on('modify', (file) => {
        if (file instanceof TFile) this.#cache.invalidate(file.path)
      })
    )
    this.plugin.registerEvent(
      this.plugin.app.vault.on('delete', (file) => {
        if (file instanceof TFile) this.#cache.invalidate(file.path)
      })
    )
    this.plugin.registerEvent(
      this.plugin.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile) this.#cache.rename(oldPath, file.path)
      })
    )

    const documentTaskCtx = {
      app: this.plugin.app,
      resolveModel: () => resolveTaskModel(this.globalSettings),
      // Document interception fires only on the `'everywhere'` scope;
      // `'lists'` leaves Obsidian's checkbox alone. Rendering is
      // flow-level (`TaskFlow.rendering`) — one mode per flow.
      isEnabled: () =>
        this.globalSettings.taskInteractionScope === 'everywhere',
    }

    this.plugin.registerMarkdownPostProcessor((el, ctx) => {
      processDocumentTasks(el, ctx, documentTaskCtx)
    })

    // Live-preview editor surface — a per-editor CodeMirror
    // ViewPlugin that attaches its own click / context-menu handlers
    // (via `view.dom`) and runs a MutationObserver to swap the
    // native checkbox for our icon. Cycling uses `view.dispatch`
    // rather than `vault.process` so the edit lands inside the
    // editor's own state machine (this is the pattern obsidian-tasks
    // uses and the only one that survives Obsidian's checkbox
    // re-render).
    this.plugin.registerEditorExtension(
      documentTaskLivePreviewExtension(documentTaskCtx)
    )

    // Integrate status options into Obsidian's native editor context
    // menu rather than overriding right-click. Items only appear when
    // the cursor is sitting on a task line the active model
    // recognises.
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('editor-menu', (menu, editor, view) => {
        if (this.globalSettings.taskInteractionScope !== 'everywhere') return
        if (!(view instanceof MarkdownView)) return
        const file = view.file
        if (!file) return
        const cursor = editor.getCursor()
        const lineText = editor.getLine(cursor.line)
        const model = resolveTaskModel(this.globalSettings)
        const parsed = model.parseLine(lineText)
        if (!parsed) return
        menu.addSeparator()
        appendStatusMenuItems(
          menu,
          {
            sourceFile: file,
            sourceLine: cursor.line,
            status: parsed.status,
          },
          model,
          this.plugin.app
        )
      })
    )

    this.plugin.registerMarkdownCodeBlockProcessor(
      'journal-tasks',
      async (source, el, ctx) => {
        try {
          await this.renderBlock(source, el, ctx)
        } catch (error) {
          this.mountError(el, ctx, `${error}`)
        }
      }
    )
  }

  useSettings(settings: JournalFolderSettings): void {
    super.useSettings(settings)
    // Switching the active model invalidates every cached entry —
    // their parsed status IDs are model-specific.
    this.#cache.clear()
    // Force open CodeMirror editors to re-run their ViewPlugin
    // updates so toggles of `taskInteractionScope` and edits to the
    // active flow take effect without requiring the user to type.
    // `updateOptions()` re-applies extensions across all editors;
    // the per-editor MutationObserver inside each plugin also
    // re-scans whenever Obsidian re-renders content.
    this.plugin.app.workspace.updateOptions?.()
  }

  private async renderBlock(
    source: string,
    el: HTMLElement,
    ctx: { sourcePath: string; addChild: (c: MarkdownRenderChild) => void }
  ): Promise<void> {
    const settings = this.globalSettings
    const blockConfig = parseJournalTasksBlock(source)

    const hostFile = this.plugin.app.vault.getAbstractFileByPath(
      ctx.sourcePath
    )
    const host = hostFile instanceof TFile ? hostFile : null

    const folders = blockConfig.folders ?? (host ? [host.parent?.path ?? ''] : [])
    if (folders.length === 0) {
      this.mountError(
        el,
        ctx,
        'journal-tasks: `folders:` is required when the host note is not ' +
          'a recognised journal note.'
      )
      return
    }

    // Hand the entire lifecycle to a render-child that subscribes
    // itself to vault mutations and re-renders. Without this the
    // mounted Svelte component held a stale `tasks` snapshot — when
    // a task was cycled elsewhere (the document path, the sidebar
    // panel, the same block), the cached statuses on this view fell
    // out of sync and the next click tripped the disk-level line-
    // match guard with the stale-location Notice.
    ctx.addChild(
      new TasksBlockRenderChild(
        el,
        this.plugin,
        () => this.globalSettings,
        () => this.#cache,
        host,
        blockConfig
      )
    )
  }

  private mountError(
    el: HTMLElement,
    ctx: { addChild: (c: MarkdownRenderChild) => void },
    error: string
  ): void {
    el.empty()
    const component = mount(ErrorMessage, {
      target: el,
      props: { error },
    })
    ctx.addChild(new SvelteRenderChild(el, component))
  }
}

// Markdown-render child for a single `journal-tasks` block. Holds the
// mounted Svelte component, the view-local `showCompleted` toggle
// state, and the vault-event subscriptions that drive re-renders.
// `onload` mounts the first instance; vault `modify` / `delete` /
// `rename` events trigger `scheduleRender`, which rebuilds the task
// snapshot from the (now-refreshed) cache and remounts. `onunload`
// drops every subscription and unmounts the component.
class TasksBlockRenderChild extends MarkdownRenderChild {
  private component: ReturnType<typeof mount> | null = null
  private showCompleted: boolean
  private renderScheduled = false
  private readonly blockFolders: string[]
  // Per-block collapsed-paths set. Owned on the render-child instance
  // so it survives the unmount/remount cycle the child runs on every
  // vault mutation, and so every `journal-tasks` block on a page has
  // its own independent state.
  private readonly collapsedNotePaths = new SvelteSet<string>()

  constructor(
    containerEl: HTMLElement,
    private readonly plugin: Plugin,
    private readonly getSettings: () => JournalFolderSettings,
    private readonly getCache: () => TaskCache,
    private readonly host: TFile | null,
    private readonly blockConfig: ReturnType<typeof parseJournalTasksBlock>
  ) {
    super(containerEl)
    const settings = this.getSettings()
    this.showCompleted =
      blockConfig.showCompleted ?? settings.tasksShowCompleted
    this.blockFolders =
      blockConfig.folders ?? (host ? [host.parent?.path ?? ''] : [])
  }

  onload(): void {
    // Vault mutations are how this view learns about a status change
    // — anywhere. Schedule a re-render rather than rendering inline
    // so a burst of mutations (rename → modify, multi-file edits)
    // collapses to one rebuild per animation frame.
    this.registerEvent(
      this.plugin.app.vault.on('modify', (file) => {
        if (this.isInScope(file)) this.scheduleRender()
      })
    )
    this.registerEvent(
      this.plugin.app.vault.on('delete', (file) => {
        if (this.isInScope(file)) this.scheduleRender()
      })
    )
    this.registerEvent(
      this.plugin.app.vault.on('rename', (file) => {
        if (this.isInScope(file)) this.scheduleRender()
      })
    )
    // noinspection JSIgnoredPromiseFromCall
    this.render()
  }

  onunload(): void {
    this.tearDownComponent()
  }

  // A file is in scope when it lives directly inside one of the block's
  // folders. Cheap test so the listener stays inexpensive for vault-
  // wide modify bursts. Conservative on non-`TFile` events (rename
  // can fire with a TFolder-typed first arg).
  private isInScope(file: unknown): boolean {
    if (!(file instanceof TFile)) return false
    const parentPath = file.parent?.path ?? ''
    return this.blockFolders.some(
      (folder) => folder === parentPath || folder === '/' && parentPath === ''
    )
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return
    this.renderScheduled = true
    requestAnimationFrame(() => {
      this.renderScheduled = false
      // noinspection JSIgnoredPromiseFromCall
      this.render()
    })
  }

  private async render(): Promise<void> {
    const settings = this.getSettings()
    const factory = journalNoteFactoryWithSettings(settings)
    const isJournalHost =
      !!this.host &&
      isJournalFileBasename(this.host.basename, !!settings.quartersEnabled)
    let activeNote: JournalNote | null = null
    if (this.host && isJournalHost) {
      try {
        activeNote = factory(this.host)
      } catch {
        activeNote = null
      }
    }

    const referenceRange = buildReferenceRange({
      host: 'note',
      referenceMode: 'dynamic',
      activeNote,
    })

    const candidates = findTaskCandidates({
      app: this.plugin.app,
      folders: this.blockFolders,
      units: this.blockConfig.units ?? effectiveUnits(settings),
      referenceRange,
      settings,
    })

    const model = resolveTaskModel(settings)
    const cache = this.getCache()
    const allTasks: JournalTask[] = []
    for (const candidate of candidates) {
      const tasks = await cache.getTasks(
        candidate.file,
        model,
        candidate.note
      )
      for (const task of tasks) allTasks.push(task)
    }

    const sorted = sortTasks(allTasks)
    const maxItems = this.blockConfig.maxItems ?? settings.tasksMaxItems
    // Filter completed *before* the cap so the cap only trims visible
    // tasks and `hiddenCount` reflects every completed task in scope —
    // not just the ones that happened to land inside the pre-cap slice.
    const visible = this.showCompleted
      ? sorted
      : sorted.filter((t) => !model.isDone(t.status))
    const totalBeforeCap = visible.length
    const capped = visible.slice(0, maxItems)
    const truncated = totalBeforeCap > capped.length
    const filtered = capped
    const hiddenCount = this.showCompleted
      ? 0
      : sorted.length - visible.length

    this.tearDownComponent()
    this.containerEl.empty()
    // @ts-ignore — Svelte 5 mount typing.
    this.component = mount(TaskList, {
      target: this.containerEl,
      props: {
        tasks: filtered,
        model,
        app: this.plugin.app,
        showCompleted: this.showCompleted,
        hiddenCompletedCount: hiddenCount,
        totalBeforeCap,
        truncated,
        header: 'note',
        collapsedNotePaths: this.collapsedNotePaths,
        caption: this.blockConfig.caption,
        onToggleShowCompleted: () => {
          this.showCompleted = !this.showCompleted
          // noinspection JSIgnoredPromiseFromCall
          this.render()
        },
        onOpenSettings: () => {
          // @ts-ignore — Obsidian's setting API is private.
          this.plugin.app.setting?.open?.()
          // @ts-ignore
          this.plugin.app.setting?.openTabById?.(this.plugin.manifest.id)
        },
      },
    })
  }

  private tearDownComponent(): void {
    if (!this.component) return
    try {
      unmount(this.component)
    } catch {
      // Already torn down.
    }
    this.component = null
  }
}

class SvelteRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private component: ReturnType<typeof mount>
  ) {
    super(containerEl)
  }

  onunload(): void {
    try {
      unmount(this.component)
    } catch {
      // Already torn down.
    }
  }
}
