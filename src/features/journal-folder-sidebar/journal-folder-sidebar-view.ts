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

import { ItemView, type Plugin, TFile, type WorkspaceLeaf } from 'obsidian'
import { mount, unmount } from 'svelte'
import {
  configPathFor,
  findJournalFolderPaths,
  type JournalFolderSettings,
} from '../../data-access'
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
}

export type ActiveFileSnapshot = {
  path: string
  basename: string
  parentPath: string
}

export class JournalFolderSidebarView extends ItemView {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #component: any = null
  #api: SidebarUpdateApi | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: Plugin,
    private readonly getSettings: () => JournalFolderSettings,
    private readonly saveSettings: (s: JournalFolderSettings) => Promise<void>,
    private readonly registry: ViewRegistry
  ) {
    super(leaf)
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
        saveSettings: (s: JournalFolderSettings) => this.saveSettings(s),
        registerApi: (api: SidebarUpdateApi) => {
          this.#api = api
        },
        onInitJournalFolder: () => this.openInitFolderPicker(),
        onEditFolderConfig: (folderPath: string) =>
          this.openFolderConfigModal(folderPath),
        buildAnchorNote: (folderPath: string, anchorBasename: string) =>
          buildAnchorNote(
            this.plugin.app,
            folderPath,
            anchorBasename,
            this.getSettings()
          ),
        confirmCreate: (basename: string) =>
          confirmCreateNote(this.plugin.app, basename),
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
  }

  private refreshKnownFolders(): void {
    this.#api?.setKnownFolders(findJournalFolderPaths(this.plugin.app))
  }

  private onVaultMutation(): void {
    this.refreshKnownFolders()
    this.#api?.bumpVault()
  }

  private openFolderConfigModal(folderPath: string): void {
    new FolderConfigModal(this.plugin.app, folderPath, () =>
      this.getSettings()
    ).open()
  }

  private openInitFolderPicker(): void {
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
    }
  }
}
