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

import { type Plugin, type WorkspaceLeaf } from 'obsidian'
import {
  type JournalFolderSettings,
  PluginFeature,
} from '../../data-access'
import type { TaskCache } from '../journal-tasks'
import {
  JournalTasksSidebarView,
  VIEW_TYPE_JOURNAL_TASKS_SIDEBAR,
} from './journal-tasks-sidebar-view'

export { VIEW_TYPE_JOURNAL_TASKS_SIDEBAR }

// Registers the tasks-only sidebar view + its ribbon icon. The view
// shares the global `TaskCache` with the combined sidebar and the
// in-note `journal-tasks` block, so editing a task on any surface
// invalidates the same cache entry and refreshes the rest on the
// next vault `modify` event.
export class JournalTasksSidebarFeature extends PluginFeature {
  readonly #views = new Set<JournalTasksSidebarView>()

  constructor(
    plugin: Plugin,
    private readonly saveSettingsFn: (
      settings: JournalFolderSettings
    ) => Promise<void>,
    private readonly taskCache: TaskCache
  ) {
    super(plugin)
  }

  async load(): Promise<void> {
    this.plugin.registerView(
      VIEW_TYPE_JOURNAL_TASKS_SIDEBAR,
      (leaf) =>
        new JournalTasksSidebarView(
          leaf,
          this.plugin,
          () => this.globalSettings,
          this.saveSettingsFn,
          this.taskCache,
          {
            register: (v) => this.#views.add(v),
            unregister: (v) => this.#views.delete(v),
          }
        )
    )
  }

  unload(): void {
    this.plugin.app.workspace.detachLeavesOfType(
      VIEW_TYPE_JOURNAL_TASKS_SIDEBAR
    )
  }

  useSettings(settings: JournalFolderSettings): void {
    super.useSettings(settings)
    this.#views.forEach((v) => v.onSettingsChanged(settings))
  }

  // Public so the master ribbon menu can open this sidebar.
  async activate(): Promise<void> {
    const ws = this.plugin.app.workspace
    const existing = ws.getLeavesOfType(VIEW_TYPE_JOURNAL_TASKS_SIDEBAR)
    if (existing.length > 0) {
      ws.revealLeaf(existing[0])
      return
    }
    const leaf: WorkspaceLeaf | null = ws.getRightLeaf(false)
    if (!leaf) return
    await leaf.setViewState({
      type: VIEW_TYPE_JOURNAL_TASKS_SIDEBAR,
      active: true,
    })
    ws.revealLeaf(leaf)
  }
}
