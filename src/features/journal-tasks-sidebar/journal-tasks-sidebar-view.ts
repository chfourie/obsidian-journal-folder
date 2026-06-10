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
  debounce,
  ItemView,
  type Plugin,
  TFile,
  type WorkspaceLeaf,
} from 'obsidian'
import { mount, unmount } from 'svelte'
import {
  isJournalFileBasename,
  isJournalFolder,
  type JournalFolderSettings,
  openPluginSettings,
} from '../../data-access'
import {
  activeLeafAffectsTaskScope,
  computeTaskSnapshot,
  TASK_REFRESH_DEBOUNCE_MS,
  type TaskCache,
  taskEventAffectsScope,
  type TaskEventScope,
  type TaskPanelSnapshot,
} from '../journal-tasks'
import JournalTasksSidebar from './JournalTasksSidebar.svelte'

export const VIEW_TYPE_JOURNAL_TASKS_SIDEBAR = 'journal-tasks-sidebar'

type ViewRegistry = {
  register: (v: JournalTasksSidebarView) => void
  unregister: (v: JournalTasksSidebarView) => void
}

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
  #component: ReturnType<typeof mount> | null = null
  #api: TasksOnlyUpdateApi | null = null

  // Trailing debounce so a burst of vault events (a sync importing many
  // files, a multi-file edit) collapses into one snapshot rebuild.
  #scheduleRefresh = debounce(
    () => {
      // noinspection JSIgnoredPromiseFromCall
      void this.refresh()
    },
    TASK_REFRESH_DEBOUNCE_MS,
    true
  )

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
    // eslint-disable-next-line obsidianmd/ui/sentence-case -- 'Journal Tasks' is the plugin's own (proper) feature name
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
          void this.refresh()
        },
        obsidianApp: this.plugin.app,
        openPluginSettings: () => this.openPluginSettings(),
      },
    })

    // The panel only reads the active leaf through its 'note' anchor /
    // folder mode; any other scope is leaf-independent, so skip those.
    this.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        const settings = this.getSettings()
        if (
          !activeLeafAffectsTaskScope({
            anchor: settings.tasksOnlySidebarAnchor,
            folderMode: settings.tasksOnlySidebarFolderMode,
          })
        ) {
          return
        }
        this.#scheduleRefresh()
      })
    )
    // Vault events are scope-filtered before the debounce, so typing in
    // a note outside the panel's folders never costs a snapshot rebuild.
    this.registerEvent(
      this.plugin.app.vault.on('modify', (file) => this.onFileEvent(file))
    )
    this.registerEvent(
      this.plugin.app.vault.on('create', (file) => {
        // A newly created folder is empty — its files arrive as
        // separate create events, so the folder itself is inert.
        if (file instanceof TFile) this.onFileEvent(file)
      })
    )
    this.registerEvent(
      this.plugin.app.vault.on('delete', (file) => this.onFileEvent(file))
    )
    this.registerEvent(
      this.plugin.app.vault.on('rename', (file, oldPath) =>
        this.onFileEvent(file, oldPath)
      )
    )
  }

  async onClose(): Promise<void> {
    this.registry.unregister(this)
    if (this.#component) {
      try {
        void unmount(this.#component)
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
    void this.refresh()
  }

  private async refresh(): Promise<void> {
    if (!this.#api) return
    const settings = this.getSettings()
    const snapshot = await computeTaskSnapshot(
      this.plugin.app,
      settings,
      this.taskCache,
      {
        anchor: settings.tasksOnlySidebarAnchor,
        range: settings.tasksOnlySidebarRange,
        folderMode: settings.tasksOnlySidebarFolderMode,
        folder: settings.tasksOnlySidebarFolder,
      }
    )
    this.#api.setSnapshot(snapshot)
  }

  // Schedules a refresh when the event can actually change the panel.
  // Non-file targets (folder deletes/renames) are treated conservatively —
  // a single folder event can move or remove a whole journal folder.
  private onFileEvent(file: unknown, oldPath?: string): void {
    if (!(file instanceof TFile)) {
      this.#scheduleRefresh()
      return
    }
    const scope = this.taskEventScope()
    const affected =
      taskEventAffectsScope(file.path, scope) ||
      (oldPath !== undefined && taskEventAffectsScope(oldPath, scope))
    if (affected) this.#scheduleRefresh()
  }

  private taskEventScope(): TaskEventScope {
    const settings = this.getSettings()
    return {
      folderMode: settings.tasksOnlySidebarFolderMode,
      folder: settings.tasksOnlySidebarFolder,
      activeNoteFolder: this.activeNoteFolder(settings),
      quartersEnabled: !!settings.quartersEnabled,
      isJournalFolder: (folderPath) =>
        isJournalFolder(this.plugin.app, folderPath),
    }
  }

  // Parent folder of the active journal note, or `null` when the active
  // leaf isn't a recognised journal note — mirrors `computeTaskSnapshot`'s
  // anchor detection so the gate and the snapshot agree on scope.
  private activeNoteFolder(settings: JournalFolderSettings): string | null {
    const file = this.plugin.app.workspace.getActiveFile?.()
    if (!(file instanceof TFile)) return null
    if (!isJournalFileBasename(file.basename, !!settings.quartersEnabled)) {
      return null
    }
    return file.parent?.path ?? '/'
  }

  private openPluginSettings(): void {
    openPluginSettings(this.plugin.app, this.plugin.manifest.id)
  }

}
