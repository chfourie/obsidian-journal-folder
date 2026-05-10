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

import { type Plugin, WorkspaceLeaf } from 'obsidian'
import {
  type JournalFolderSettings,
  PluginFeature,
} from '../../data-access'
import { JournalFolderSidebarView } from './journal-folder-sidebar-view'

export const VIEW_TYPE_JOURNAL_FOLDER_SIDEBAR = 'journal-folder-sidebar'

export class JournalFolderSidebarFeature extends PluginFeature {
  readonly #views = new Set<JournalFolderSidebarView>()

  constructor(
    plugin: Plugin,
    private readonly saveSettingsFn: (
      settings: JournalFolderSettings
    ) => Promise<void>
  ) {
    super(plugin)
  }

  async load(): Promise<void> {
    this.plugin.registerView(
      VIEW_TYPE_JOURNAL_FOLDER_SIDEBAR,
      (leaf) =>
        new JournalFolderSidebarView(
          leaf,
          this.plugin,
          () => this.globalSettings,
          this.saveSettingsFn,
          {
            register: (v) => this.#views.add(v),
            unregister: (v) => this.#views.delete(v),
          }
        )
    )

    this.plugin.addRibbonIcon(
      'calendar-days',
      'Open Journal Folder sidebar',
      () => {
        // noinspection JSIgnoredPromiseFromCall
        this.activate()
      }
    )
  }

  unload(): void {
    // The view's onClose handles its own cleanup; we just detach leaves so
    // the view-type registration disposes cleanly when the plugin unloads.
    this.plugin.app.workspace.detachLeavesOfType(
      VIEW_TYPE_JOURNAL_FOLDER_SIDEBAR
    )
  }

  useSettings(settings: JournalFolderSettings): void {
    super.useSettings(settings)
    this.#views.forEach((v) => v.onSettingsChanged(settings))
  }

  private async activate(): Promise<void> {
    const ws = this.plugin.app.workspace
    const existing = ws.getLeavesOfType(VIEW_TYPE_JOURNAL_FOLDER_SIDEBAR)
    if (existing.length > 0) {
      ws.revealLeaf(existing[0])
      return
    }
    const leaf: WorkspaceLeaf | null = ws.getRightLeaf(false)
    if (!leaf) return
    await leaf.setViewState({
      type: VIEW_TYPE_JOURNAL_FOLDER_SIDEBAR,
      active: true,
    })
    ws.revealLeaf(leaf)
  }
}
