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
  ItemView,
  Menu,
  type Plugin,
  type WorkspaceLeaf,
} from 'obsidian'
import { mount, unmount } from 'svelte'
import {
  findJournalFolderPaths,
  type JournalFolderSettings,
} from '../../data-access'
import {
  computeTaskSnapshot,
  type TaskCache,
  type TaskPanelSnapshot,
} from '../journal-tasks'
import JournalTasksSidebar from './JournalTasksSidebar.svelte'

export const VIEW_TYPE_JOURNAL_TASKS_SIDEBAR = 'journal-tasks-sidebar'

type ViewRegistry = {
  register: (v: JournalTasksSidebarView) => void
  unregister: (v: JournalTasksSidebarView) => void
}

export type MenuTrigger =
  | { kind: 'mouse'; event: MouseEvent }
  | { kind: 'keyboard'; rect: DOMRect }

export type TasksOnlyUpdateApi = {
  setSettings: (s: JournalFolderSettings) => void
  setSnapshot: (s: TaskPanelSnapshot) => void
}

// Slim sidebar that shows only the task panel — no folder picker
// and no calendar. Shares the underlying snapshot + cache machinery
// with the combined journal sidebar (`computeTaskSnapshot`,
// `TaskCache`), so cache hits / settings changes / vault mutations
// keep both surfaces in sync. Independent collapsed-paths state is
// owned per-instance by the mounted Svelte component.
export class JournalTasksSidebarView extends ItemView {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #component: any = null
  #api: TasksOnlyUpdateApi | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: Plugin,
    private readonly getSettings: () => JournalFolderSettings,
    private readonly saveSettings: (s: JournalFolderSettings) => Promise<void>,
    private readonly taskCache: TaskCache,
    private readonly registry: ViewRegistry
  ) {
    super(leaf)
  }

  getViewType(): string {
    return VIEW_TYPE_JOURNAL_TASKS_SIDEBAR
  }

  getDisplayText(): string {
    return 'Journal Tasks'
  }

  getIcon(): string {
    return 'list-checks'
  }

  async onOpen(): Promise<void> {
    this.registry.register(this)
    const target = this.contentEl
    target.empty()
    target.addClass('journal-tasks-sidebar')

    this.#component = mount(JournalTasksSidebar, {
      target,
      props: {
        initialSettings: this.getSettings(),
        initialSnapshot: { tasks: [], totalBeforeCap: 0, truncated: false },
        saveSettings: (s: JournalFolderSettings) => this.saveSettings(s),
        registerApi: (api: TasksOnlyUpdateApi) => {
          this.#api = api
          // noinspection JSIgnoredPromiseFromCall
          this.refresh()
        },
        obsidianApp: this.plugin.app,
        openTaskScopeMenu: (trigger: MenuTrigger) =>
          this.openTaskScopeMenu(trigger),
        openPluginSettings: () => this.openPluginSettings(),
      },
    })

    this.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        // noinspection JSIgnoredPromiseFromCall
        this.refresh()
      })
    )
    this.registerEvent(
      this.plugin.app.vault.on('modify', () => {
        // noinspection JSIgnoredPromiseFromCall
        this.refresh()
      })
    )
    this.registerEvent(
      this.plugin.app.vault.on('create', () => {
        // noinspection JSIgnoredPromiseFromCall
        this.refresh()
      })
    )
    this.registerEvent(
      this.plugin.app.vault.on('delete', () => {
        // noinspection JSIgnoredPromiseFromCall
        this.refresh()
      })
    )
    this.registerEvent(
      this.plugin.app.vault.on('rename', () => {
        // noinspection JSIgnoredPromiseFromCall
        this.refresh()
      })
    )
  }

  async onClose(): Promise<void> {
    this.registry.unregister(this)
    if (this.#component) {
      try {
        unmount(this.#component)
      } catch {
        // Svelte sometimes throws on unmount during plugin teardown
        // when the host element has already been detached.
      }
      this.#component = null
    }
    this.#api = null
  }

  onSettingsChanged(settings: JournalFolderSettings): void {
    this.#api?.setSettings(settings)
    // noinspection JSIgnoredPromiseFromCall
    this.refresh()
  }

  private async refresh(): Promise<void> {
    if (!this.#api) return
    const settings = this.getSettings()
    const snapshot = await computeTaskSnapshot(
      this.plugin.app,
      settings,
      this.taskCache,
      settings.tasksOnlySidebarReference
    )
    this.#api.setSnapshot(snapshot)
  }

  private openPluginSettings(): void {
    // @ts-ignore — `setting` is on the runtime App object but not in
    // the public TypeScript surface.
    this.plugin.app.setting?.open?.()
    // @ts-ignore
    this.plugin.app.setting?.openTabById?.(this.plugin.manifest.id)
  }

  // Mirrors the combined sidebar's scope menu — multi-select folders
  // narrow the `Today` reference. In `Dynamic` mode the
  // `tasksSidebarFolders` setting is ignored at compute time, so
  // editing it from here is harmless (the menu still appears so the
  // user can pre-configure before switching modes).
  private openTaskScopeMenu(trigger: MenuTrigger): void {
    const settings = this.getSettings()
    const known = findJournalFolderPaths(this.plugin.app).filter(
      (p) => p !== '' && p !== '/'
    )
    const selected = new Set(settings.tasksSidebarFolders)
    const menu = new Menu()
    menu.addItem((mi) => {
      mi.setTitle('All journal folders')
      if (selected.size === 0) mi.setIcon('check')
      mi.onClick(async () => {
        await this.saveSettings({ ...settings, tasksSidebarFolders: [] })
      })
    })
    if (known.length > 0) menu.addSeparator()
    for (const folder of known) {
      menu.addItem((mi) => {
        mi.setTitle(folder)
        if (selected.has(folder)) mi.setIcon('check')
        mi.onClick(async () => {
          const next = new Set(selected)
          if (next.has(folder)) next.delete(folder)
          else next.add(folder)
          await this.saveSettings({
            ...settings,
            tasksSidebarFolders: [...next].sort(),
          })
        })
      })
    }
    if (trigger.kind === 'mouse') menu.showAtMouseEvent(trigger.event)
    else menu.showAtPosition({ x: trigger.rect.left, y: trigger.rect.bottom })
  }
}
