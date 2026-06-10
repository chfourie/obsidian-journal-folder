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
  Notice,
  type Plugin,
  type TAbstractFile,
  TFile,
  type WorkspaceLeaf,
} from 'obsidian'
import { mount, unmount } from 'svelte'
import {
  configPathFor,
  findJournalFolderPaths,
  FolderSettingsResolver,
  isJournalFileBasename,
  isJournalFolder,
  type JournalFolderSettings,
  openPluginSettings,
} from '../../data-access'
import {
  isTemplateableNote,
  isTruthySetting,
  resolveNoteTemplate,
} from '../journal-auto-template'
import { confirmModal } from '../../ui'
import {
  activeLeafAffectsTaskScope,
  computeTaskSnapshot,
  TASK_REFRESH_DEBOUNCE_MS,
  type TaskCache,
  taskEventAffectsScope,
  type TaskEventScope,
  type TaskPanelSnapshot,
} from '../journal-tasks'
export type { TaskPanelSnapshot }
import {
  classifyVaultMutation,
  type VaultMutationKind,
} from './sidebar-vault-events'
import { VIEW_TYPE_JOURNAL_FOLDER_SIDEBAR } from './journal-folder-sidebar-feature'
import JournalFolderSidebar from './JournalFolderSidebar.svelte'
import {
  findInitialisableFolders,
  initialiseJournalFolder,
} from './init-journal-folder'
import { InitJournalFolderModal } from './init-journal-folder-modal'
import { buildAnchorNote } from './sidebar-anchor'
import { confirmCreateNote } from '../journal-header/confirm-create-modal'
import { FolderConfigModal } from './folder-config-modal'

type ViewRegistry = {
  register: (v: JournalFolderSidebarView) => void
  unregister: (v: JournalFolderSidebarView) => void
}

// Callback the Svelte component registers so the view can push settings
// updates and active-leaf events into reactive state without re-mounting.
export type SidebarUpdateApi = {
  setSettings: (s: JournalFolderSettings) => void
  setKnownFolders: (folders: string[]) => void
  setActiveFile: (file: ActiveFileSnapshot | null) => void
  setSelected: (path: string) => void
  // Bumped on vault mutations (create / delete / rename) that touch the
  // selected folder, so the calendar's `$derived(buildAnchorNote(...))`
  // recomputes — the synthetic anchor's sibling-names snapshot is frozen
  // after first use, so existence-flag accuracy after a deletion or
  // rename requires us to rebuild the anchor.
  bumpVault: () => void
  setTaskPanelSnapshot: (snapshot: TaskPanelSnapshot) => void
  // Read-back of the component's currently selected folder, so the vault
  // listeners can gate the anchor rebuild on events that touch it.
  getSelectedFolder: () => string
}

export type ActiveFileSnapshot = {
  path: string
  basename: string
  parentPath: string
  // True when the active file is a journal note in a templating-enabled
  // journal folder — gates the *Re-populate from template* menu item.
  repopulatable: boolean
}

// Items the Svelte component renders in its `<body>`-portaled menu /
// folder-picker panels (`SidebarMenuPanel.svelte`). Both the More... menu
// and the journal-folder picker share this shape.
export type SidebarMenuItem =
  | {
      kind: 'item'
      title: string
      icon?: string
      onClick: () => void
    }
  | { kind: 'separator' }

export class JournalFolderSidebarView extends ItemView {
  #component: ReturnType<typeof mount> | null = null
  #api: SidebarUpdateApi | null = null
  readonly #resolver: FolderSettingsResolver

  // Vault events accumulate the work they require in these flags; the
  // trailing-debounced flush below runs once per event burst and executes
  // only the flagged reactions. Each flag's action is expensive enough to
  // gate: `refreshKnownFolders` walks every markdown file, `bumpVault`
  // rebuilds the calendar anchor, and the task refresh recomputes the
  // whole panel snapshot.
  #pendingKnownFolders = false
  #pendingBump = false
  #pendingTasks = false
  #flushPendingRefresh = debounce(
    () => {
      const refreshFolders = this.#pendingKnownFolders
      const bump = this.#pendingBump
      const refreshTasks = this.#pendingTasks
      this.#pendingKnownFolders = false
      this.#pendingBump = false
      this.#pendingTasks = false
      if (refreshFolders) this.refreshKnownFolders()
      if (bump) this.#api?.bumpVault()
      if (refreshTasks) {
        // noinspection JSIgnoredPromiseFromCall
        void this.refreshTaskPanel()
      }
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
    this.#resolver = new FolderSettingsResolver(plugin)
  }

  getViewType(): string {
    return VIEW_TYPE_JOURNAL_FOLDER_SIDEBAR
  }

  getDisplayText(): string {
    // eslint-disable-next-line obsidianmd/ui/sentence-case -- 'Journal Folder' is the plugin's own (proper) name
    return 'Journal Folder'
  }

  getIcon(): string {
    return 'calendar-days'
  }

  async onOpen(): Promise<void> {
    this.registry.register(this)
    const target = this.contentEl
    target.empty()
    target.addClass('journal-folder-sidebar')

    this.#component = mount(JournalFolderSidebar, {
      target,
      props: {
        initialSettings: this.getSettings(),
        initialKnownFolders: findJournalFolderPaths(this.plugin.app),
        initialActiveFile: this.snapshotActiveFile(),
        initialTaskPanel: { tasks: [], totalBeforeCap: 0, truncated: false },
        saveSettings: (s: JournalFolderSettings) => this.saveSettings(s),
        registerApi: (api: SidebarUpdateApi) => {
          this.#api = api
          // Kick off an initial scan once the component has wired up.
          // noinspection JSIgnoredPromiseFromCall
          void this.refreshTaskPanel()
        },
        openPluginSettings: () => this.openPluginSettings(),
        onInitJournalFolder: () => this.openInitFolderPicker(),
        onEditFolderConfig: (folderPath: string) =>
          this.openFolderConfigModal(folderPath),
        onRepopulateFromTemplate: (filePath: string) =>
          this.repopulateFromTemplate(filePath),
        buildAnchorNote: (folderPath: string, anchorBasename: string) =>
          buildAnchorNote(
            this.plugin.app,
            folderPath,
            anchorBasename,
            this.getSettings()
          ),
        confirmCreate: (basename: string) =>
          confirmCreateNote(this.plugin.app, basename),
        obsidianApp: this.plugin.app,
        navigate: (url: string, sourceFolderPath: string) => {
          // `openLinkText` resolves relative-ish links against a source
          // path. Use the selected folder's `journal-folder.md` as the
          // source so the link's folder context matches the calendar's.
          void this.plugin.app.workspace.openLinkText(
            url,
            configPathFor(sourceFolderPath),
            false
          )
        },
      },
    })

    // Refresh the known-folders list whenever the vault layout changes
    // — new journal folders appearing (or disappearing) shouldn't require
    // closing and reopening the sidebar. Also bump the vault tick so the
    // calendar's anchor rebuilds and existence flags catch up to the
    // disk state. `classifyVaultMutation` drops the events that can't
    // affect any of those, and the debounced flush coalesces the rest.
    this.registerEvent(
      this.plugin.app.vault.on('create', (file) =>
        this.onVaultMutation('create', file)
      )
    )
    this.registerEvent(
      this.plugin.app.vault.on('delete', (file) =>
        this.onVaultMutation('delete', file)
      )
    )
    this.registerEvent(
      this.plugin.app.vault.on('rename', (file, oldPath) =>
        this.onVaultMutation('rename', file, oldPath)
      )
    )

    this.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        // The snapshot push stays immediate — it gates menu items and
        // drives dynamic-mode folder switching, both of which should
        // feel instant.
        this.#api?.setActiveFile(this.snapshotActiveFile())
        // The task panel only reads the active leaf through its 'note'
        // anchor / folder mode; any other scope is leaf-independent.
        const settings = this.getSettings()
        if (!settings.tasksSidebarEnabled) return
        if (
          !activeLeafAffectsTaskScope({
            anchor: settings.tasksSidebarAnchor,
            folderMode: settings.tasksSidebarFolderMode,
          })
        ) {
          return
        }
        this.#pendingTasks = true
        this.#flushPendingRefresh()
      })
    )

    // Vault content edits don't trigger create/delete/rename — listen
    // separately for `modify` so a task ticked off in another pane
    // re-renders here. Only journal notes inside the panel's resolved
    // folder scope can change the snapshot; everything else (typing in
    // any other note) is dropped before the debounce.
    this.registerEvent(
      this.plugin.app.vault.on('modify', (file) => {
        const scope = this.taskEventScope()
        if (!scope) return
        if (!(file instanceof TFile)) return
        if (!taskEventAffectsScope(file.path, scope)) return
        this.#pendingTasks = true
        this.#flushPendingRefresh()
      })
    )
  }

  async onClose(): Promise<void> {
    this.registry.unregister(this)
    if (this.#component) {
      try {
        void unmount(this.#component)
      } catch {
        // Svelte sometimes throws on unmount during plugin teardown when
        // the host element has already been detached — safe to ignore.
      }
      this.#component = null
    }
    this.#api = null
  }

  onSettingsChanged(settings: JournalFolderSettings): void {
    this.#api?.setSettings(settings)
    // noinspection JSIgnoredPromiseFromCall
    void this.refreshTaskPanel()
  }

  private async refreshTaskPanel(): Promise<void> {
    if (!this.#api) return
    const settings = this.getSettings()
    if (!settings.tasksSidebarEnabled) {
      this.#api.setTaskPanelSnapshot({
        tasks: [],
        totalBeforeCap: 0,
        truncated: false,
      })
      return
    }
    const snapshot = await computeTaskSnapshot(
      this.plugin.app,
      settings,
      this.taskCache,
      {
        anchor: settings.tasksSidebarAnchor,
        range: settings.tasksSidebarRange,
        folderMode: settings.tasksSidebarFolderMode,
        folder: settings.tasksSidebarFolder,
      }
    )
    this.#api.setTaskPanelSnapshot(snapshot)
  }

  private openPluginSettings(): void {
    openPluginSettings(this.plugin.app, this.plugin.manifest.id)
  }

  private refreshKnownFolders(): void {
    this.#api?.setKnownFolders(findJournalFolderPaths(this.plugin.app))
  }

  private onVaultMutation(
    kind: VaultMutationKind,
    file: TAbstractFile,
    oldPath?: string
  ): void {
    const actions = classifyVaultMutation({
      kind,
      paths: oldPath !== undefined ? [file.path, oldPath] : [file.path],
      isFolderEvent: !(file instanceof TFile),
      selectedFolder: this.#api?.getSelectedFolder() ?? '',
      taskScope: this.taskEventScope(),
    })
    if (
      !actions.refreshKnownFolders &&
      !actions.bumpVault &&
      !actions.refreshTasks
    ) {
      return
    }
    this.#pendingKnownFolders ||= actions.refreshKnownFolders
    this.#pendingBump ||= actions.bumpVault
    this.#pendingTasks ||= actions.refreshTasks
    this.#flushPendingRefresh()
  }

  // The task panel's event scope for vault-listener gating, or `null`
  // when the panel is disabled (no snapshot to keep fresh).
  private taskEventScope(): TaskEventScope | null {
    const settings = this.getSettings()
    if (!settings.tasksSidebarEnabled) return null
    return {
      folderMode: settings.tasksSidebarFolderMode,
      folder: settings.tasksSidebarFolder,
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

  private openFolderConfigModal(folderPath: string): void {
    new FolderConfigModal(this.plugin.app, folderPath, () =>
      this.getSettings()
    ).open()
  }

  // Public so the master ribbon menu can drive the same flow via the feature.
  openInitFolderPicker(): void {
    const candidates = findInitialisableFolders(this.plugin.app)
    new InitJournalFolderModal(this.plugin.app, candidates, async (folder) => {
      try {
        await initialiseJournalFolder(this.plugin.app, folder)
      } catch (err) {
        // The vault.create call can reject if a file with the same path
        // appears between the candidate scan and the create call (e.g.
        // another plugin race). Log + bail rather than throw at the user.
        console.error(
          '[journal-folder] failed to initialise folder',
          folder.path,
          err
        )
        return
      }
      // The vault `create` event fires here too and refreshes via
      // `refreshKnownFolders`, but ordering is async — invoke it
      // explicitly so the new folder is in the dropdown before we ask the
      // component to switch to it.
      this.refreshKnownFolders()
      this.#api?.setSelected(folder.path)
    }).open()
  }

  private snapshotActiveFile(): ActiveFileSnapshot | null {
    const file = this.plugin.app.workspace.getActiveFile?.()
    if (!(file instanceof TFile)) return null
    return {
      path: file.path,
      basename: file.basename,
      parentPath: file.parent?.path ?? '',
      repopulatable: this.canRepopulate(file),
    }
  }

  // Per-folder-resolved settings for a file (honours `journal-folder.md`
  // front-matter overrides for `quartersEnabled` / `autoTemplateEnabled`).
  private resolveFileSettings(file: TFile): JournalFolderSettings {
    return this.#resolver.resolve(this.getSettings(), file, '')
  }

  // Whether the *Re-populate from template* action applies to `file`:
  // templating is enabled (global or per-folder) and the file is a journal
  // note in a journal folder.
  private canRepopulate(file: TFile): boolean {
    const settings = this.resolveFileSettings(file)
    if (!isTruthySetting(settings.autoTemplateEnabled)) return false
    return isTemplateableNote(this.plugin.app, file, settings)
  }

  // Overwrites the note with its resolved template, after a destructive
  // confirmation. Re-checks eligibility (the active file may have changed
  // since the menu opened) and resolves the template through the same path the
  // auto-template create listener uses.
  private async repopulateFromTemplate(filePath: string): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(filePath)
    if (!(file instanceof TFile)) return
    const settings = this.resolveFileSettings(file)
    if (!isTruthySetting(settings.autoTemplateEnabled)) return
    const template = await resolveNoteTemplate(this.plugin.app, file, settings)
    if (template === null) {
      new Notice('No template is available for this note.')
      return
    }
    const confirmed = await confirmModal(this.plugin.app, {
      title: 'Re-populate from template?',
      message:
        `This replaces the entire contents of "${file.basename}" with its ` +
        `template. This can't be undone.`,
      confirmText: 'Replace',
      destructive: true,
    })
    if (!confirmed) return
    await this.plugin.app.vault.modify(file, template)
    new Notice(`Re-populated "${file.basename}" from its template.`)
  }
}
