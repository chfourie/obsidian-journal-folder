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
  moment,
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
import { computeTaskLineEdit } from './task-line-command'
import { parseJournalTasksBlock } from './parse-block-config'
import { buildReferenceRange } from './reference-range'
import { effectiveUnits, findTaskCandidates } from './task-scope'
import { sortTasks } from './task-sorting'
import { rangeForNote } from './reference-range'
import { makeRangeCapFilter } from './task-range-cap'
import { processDocumentTasks } from './document-tasks-processor'
import { documentTaskLivePreviewExtension } from './document-task-live-preview'
import { appendStatusMenuItems } from './document-task-menu'
import { setStatusPickerMigrationProvider } from './status-picker-panel'
import {
  appendEditorMigrationItem,
  appendNoteMigrationItems,
  buildSingleTaskMigration,
  migrateInteractive,
  migrateTaskOnLine,
  migrateTasksFromNote,
  migrateTasksToNote,
  type MigrationMenuContext,
} from './task-migration-menu'
import { processMigrationReferences } from './render-migration-references'

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

  // Context handed to the migration flows. `getSettingsFor` resolves
  // folder-level overrides (front matter overlaid on global) so a
  // folder's `task-flow` / `task-migration-*` keys are honoured.
  private migrationContext(): MigrationMenuContext {
    return {
      app: this.plugin.app,
      cache: this.#cache,
      getSettingsFor: (file) => this.getSettings(file),
    }
  }

  async load(): Promise<void> {
    // Keyboard-driven task entry: on the cursor line, convert a plain
    // line into a task (at the active flow's first status) or, when it
    // is already a task, advance it to the flow's next status. Operates
    // directly on the editor's live buffer — no cache round-trip — so
    // it works on any markdown line, journal note or not. The model is
    // resolved against the active file so a folder's `task-flow`
    // override is honoured.
    this.plugin.addCommand({
      id: 'cycle-or-create-task-on-line',
      name: 'Toggle task / advance status on current line',
      editorCallback: (editor, ctx) => {
        const file = ctx.file ?? null
        const settings = file ? this.getSettings(file) : this.globalSettings
        const model = resolveTaskModel(settings)
        const cursor = editor.getCursor()
        const original = editor.getLine(cursor.line)
        const updated = computeTaskLineEdit(original, model)
        if (updated === null || updated === original) return
        editor.setLine(cursor.line, updated)
        // Keep the cursor on the same character of the original text by
        // shifting it past any prefix the rewrite inserted ahead of it.
        const delta = updated.length - original.length
        if (delta !== 0) {
          editor.setCursor({
            line: cursor.line,
            ch: Math.max(0, cursor.ch + delta),
          })
        }
      },
    })

    // Unified migration entry point: a single hotkey that opens a
    // chooser of the migration flows available in the current context
    // (this line / from this note / to this note).
    this.plugin.addCommand({
      id: 'migrate-tasks',
      name: 'Migrate tasks…',
      editorCallback: (editor, ctx) => {
        const file = ctx.file
        if (!file) return
        // noinspection JSIgnoredPromiseFromCall
        migrateInteractive(this.migrationContext(), file, editor)
      },
    })

    // Migrate the task on the cursor line into another note in the same
    // folder — the keyboard equivalent of the editor-menu "Migrate
    // task…" item.
    this.plugin.addCommand({
      id: 'migrate-task-on-line',
      name: 'Migrate task on current line…',
      editorCallback: (editor, ctx) => {
        const file = ctx.file
        if (!file) return
        migrateTaskOnLine(this.migrationContext(), file, editor)
      },
    })

    // Whole-note migration flows — keyboard equivalents of the two
    // file-menu items. They operate on the active file, so they use a
    // plain command callback rather than an editor callback.
    this.plugin.addCommand({
      id: 'migrate-tasks-from-note',
      name: 'Migrate tasks from this note…',
      callback: () => {
        const file = this.plugin.app.workspace.getActiveFile()
        if (!file) return
        // noinspection JSIgnoredPromiseFromCall
        migrateTasksFromNote(this.migrationContext(), file)
      },
    })
    this.plugin.addCommand({
      id: 'migrate-tasks-to-note',
      name: 'Migrate tasks to this note…',
      callback: () => {
        const file = this.plugin.app.workspace.getActiveFile()
        if (!file) return
        // noinspection JSIgnoredPromiseFromCall
        migrateTasksToNote(this.migrationContext(), file)
      },
    })

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

    // Lets the status picker offer a "Migrate task…" row. Registered as
    // a module-level provider (rather than threaded through every picker
    // surface) because all four surfaces converge on one imperative
    // `openStatusPicker`, and migration capability is process-wide —
    // resolved per file at call time so folder `task-flow` /
    // `task-migration-*` overrides are honoured.
    setStatusPickerMigrationProvider((target) =>
      buildSingleTaskMigration(this.migrationContext(), target)
    )

    // Reading-view rendering of migration references: render `lucide:`
    // markers as icons and fade the whole reference to the configured
    // opacity (full on hover). Independent of `taskInteractionScope`.
    this.plugin.registerMarkdownPostProcessor((el) => {
      processMigrationReferences(el, this.globalSettings)
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
        if (!(view instanceof MarkdownView)) return
        const file = view.file
        if (!file) return
        // Status cycling is gated on the `everywhere` scope (it changes
        // document-body checkbox behaviour); migration is a list-level
        // action that's always available on a task line in a journal note.
        if (this.globalSettings.taskInteractionScope === 'everywhere') {
          const cursor = editor.getCursor()
          const lineText = editor.getLine(cursor.line)
          const model = resolveTaskModel(this.globalSettings)
          const parsed = model.parseLine(lineText)
          if (parsed) {
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
          }
        }
        appendEditorMigrationItem(menu, this.migrationContext(), file, editor)
      })
    )

    // File-menu (right-click a note / its tab): whole-note migration
    // flows — "from this note" and "to this note".
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFile) {
          appendNoteMigrationItems(menu, this.migrationContext(), file)
        }
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

  unload(): void {
    super.unload()
    // Drop the module-level provider so a disabled/reloaded plugin
    // leaves no dangling closure over this feature instance.
    setStatusPickerMigrationProvider(null)
  }

  useSettings(settings: JournalFolderSettings): void {
    super.useSettings(settings)
    // Switching the active model invalidates every cached entry —
    // their parsed status IDs are model-specific.
    this.#cache.clear()
    // Keep the cache's marker list in step so task lists strip the
    // current migration references from their display text.
    this.#cache.setMigrationMarkers([
      settings.taskMigrationToMarker,
      settings.taskMigrationFromMarker,
    ])
    // Keep the cache's signifier / category config in step so task lists
    // annotate tasks and strip their tags from display text.
    this.#cache.setSignifiers(settings.signifiers)
    this.#cache.setCategories(settings.taskCategories)
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
    // Enforce category range caps relative to the host note's own period.
    // The in-note block is always measured from its host note, so the host's
    // tier is both the list range and the cap floor — a cap finer than the
    // host tier therefore doesn't bite here (same note-anchored rule the
    // sidebar applies for its *Current note* anchor). A non-journal host
    // falls back to today/day with no floor.
    const capBase = activeNote
      ? activeNote.getMoment()
      : // @ts-ignore — obsidian re-exports moment.
        moment()
    const capFilter = makeRangeCapFilter({
      base: capBase,
      listUnit: activeNote ? activeNote.getTimeUnit() : 'day',
      categories: settings.taskCategories,
      floorUnit: activeNote ? activeNote.getTimeUnit() : null,
    })
    const allTasks: JournalTask[] = []
    for (const candidate of candidates) {
      const noteRange = rangeForNote(candidate.note)
      const tasks = await cache.getTasks(
        candidate.file,
        model,
        candidate.note
      )
      for (const task of tasks) {
        if (capFilter(task, noteRange)) allTasks.push(task)
      }
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
        signifiers: settings.signifiers,
        categories: settings.taskCategories,
        categoryShowUnderNote: settings.taskCategoryShowUnderNote,
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
