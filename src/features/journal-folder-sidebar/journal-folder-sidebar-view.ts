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
  Notice,
  type Plugin,
  TFile,
  type WorkspaceLeaf,
} from 'obsidian'
import { mount, unmount } from 'svelte'
import {
  configPathFor,
  findJournalFolderPaths,
  FolderSettingsResolver,
  type JournalFolderSettings,
} from '../../data-access'
import {
  isTemplateableNote,
  isTruthySetting,
  resolveNoteTemplate,
} from '../journal-auto-template'
import { confirmModal } from '../../ui'
import {
  computeTaskSnapshot,
  type TaskCache,
  type TaskPanelSnapshot,
} from '../journal-tasks'
export type { TaskPanelSnapshot }
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
  // Bumped on every vault mutation (create / delete / rename) so the
  // calendar's `$derived(buildAnchorNote(...))` recomputes — the
  // synthetic anchor reads `parent.children` *once* at construction, so
  // existence-flag accuracy after a deletion or rename requires us to
  // rebuild the anchor.
  bumpVault: () => void
  setTaskPanelSnapshot: (snapshot: TaskPanelSnapshot) => void
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #component: any = null
  #api: SidebarUpdateApi | null = null
  readonly #resolver: FolderSettingsResolver

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
          this.refreshTaskPanel()
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
          this.plugin.app.workspace.openLinkText(
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
    // disk state.
    this.registerEvent(
      this.plugin.app.vault.on('create', () => this.onVaultMutation())
    )
    this.registerEvent(
      this.plugin.app.vault.on('delete', () => this.onVaultMutation())
    )
    this.registerEvent(
      this.plugin.app.vault.on('rename', () => this.onVaultMutation())
    )

    this.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        this.#api?.setActiveFile(this.snapshotActiveFile())
        // Dynamic-reference scope follows the active leaf, so refresh.
        // noinspection JSIgnoredPromiseFromCall
        this.refreshTaskPanel()
      })
    )

    // Vault content edits don't trigger create/delete/rename — listen
    // separately for `modify` so a task ticked off in another pane
    // re-renders here without delay.
    this.registerEvent(
      this.plugin.app.vault.on('modify', () => {
        // noinspection JSIgnoredPromiseFromCall
        this.refreshTaskPanel()
      })
    )
  }

  async onClose(): Promise<void> {
    this.registry.unregister(this)
    if (this.#component) {
      try {
        unmount(this.#component)
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
    this.refreshTaskPanel()
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
    // @ts-ignore — `setting` is on the runtime App object but not in the
    // public TypeScript surface.
    this.plugin.app.setting?.open?.()
    // @ts-ignore
    this.plugin.app.setting?.openTabById?.(this.plugin.manifest.id)
  }

  private refreshKnownFolders(): void {
    this.#api?.setKnownFolders(findJournalFolderPaths(this.plugin.app))
  }

  private onVaultMutation(): void {
    this.refreshKnownFolders()
    this.#api?.bumpVault()
    // noinspection JSIgnoredPromiseFromCall
    this.refreshTaskPanel()
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
