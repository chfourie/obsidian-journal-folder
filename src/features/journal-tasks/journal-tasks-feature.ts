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
  type Plugin,
  TFile,
} from 'obsidian'
import { mount, unmount } from 'svelte'
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
    const isJournalHost =
      !!host &&
      isJournalFileBasename(host.basename, !!settings.quartersEnabled)

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

    const units = blockConfig.units ?? effectiveUnits(settings)
    const factory = journalNoteFactoryWithSettings(settings)
    let activeNote: JournalNote | null = null
    if (host && isJournalHost) {
      try {
        activeNote = factory(host)
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
      folders,
      units,
      referenceRange,
      settings,
    })

    const model = resolveTaskModel(settings)
    const allTasks: JournalTask[] = []
    for (const candidate of candidates) {
      const tasks = await this.#cache.getTasks(
        candidate.file,
        model,
        candidate.note
      )
      for (const task of tasks) allTasks.push(task)
    }

    const sorted = sortTasks(allTasks)
    const maxItems = blockConfig.maxItems ?? settings.tasksMaxItems
    const totalBeforeCap = sorted.length
    const capped = sorted.slice(0, maxItems)

    const initialShowCompleted =
      blockConfig.showCompleted ?? settings.tasksShowCompleted
    let showCompleted = initialShowCompleted

    const render = () => {
      el.empty()
      const filtered = showCompleted
        ? capped
        : capped.filter((t) => !model.isDone(t.status))
      const hiddenCount = capped.length - filtered.length
      const app = this.plugin.app
      // @ts-ignore — Svelte 5 mount typing.
      const component = mount(TaskList, {
        target: el,
        props: {
          tasks: filtered,
          model,
          checkboxStyle: settings.taskCheckboxStyle,
          app,
          showCompleted,
          hiddenCompletedCount: hiddenCount,
          totalBeforeCap,
          header: 'note',
          onToggleShowCompleted: () => {
            showCompleted = !showCompleted
            render()
          },
          onOpenSettings: () => {
            // @ts-ignore — Obsidian's setting API is not in the public types.
            this.plugin.app.setting?.open?.()
            // @ts-ignore
            this.plugin.app.setting?.openTabById?.(this.plugin.manifest.id)
          },
        },
      })
      ctx.addChild(new SvelteRenderChild(el, component))
    }
    render()
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
