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

import { Notice, normalizePath, type Plugin, TFile } from 'obsidian'
import {
  configPathFor,
  findJournalFolderPaths,
  type JournalFolderSettings,
  moment,
  PluginFeature,
} from '../../data-access'
import { isTruthySetting } from '../journal-auto-template'
import { resolveTodayFolders } from './resolve-today-folders'
import { TodayFolderPickerModal } from './today-folder-picker-modal'

const TODAY_RIBBON_ICON = 'calendar-check'

// Adds a one-click "Today" affordance that opens (creating if needed) the
// current day's note for a journal folder. Placement is the global
// `todayButtonPlacement` setting: a dedicated top-level ribbon icon
// (`'ribbon'`), an item in the existing ribbon menu (`'menu'`, owned by the
// ribbon-menu feature, which calls `openToday()` here), or `'off'`. The
// `open-today` command is always registered so the action is reachable from
// the palette / mobile regardless of placement.
export class JournalTodayFeature extends PluginFeature {
  #ribbonEl: HTMLElement | null = null

  constructor(plugin: Plugin) {
    super(plugin)
  }

  async load(): Promise<void> {
    this.plugin.addCommand({
      id: 'open-today',
      name: "Open today's journal note",
      callback: () => void this.openToday(),
    })
    this.#reconcileRibbon()
  }

  unload(): void {
    this.#removeRibbon()
  }

  useSettings(settings: JournalFolderSettings): void {
    super.useSettings(settings)
    this.#reconcileRibbon()
  }

  // Public so the ribbon-menu feature can drive the same action from its
  // `'menu'` item. Resolves the candidate folders and either opens the single
  // one directly or shows the folder picker.
  async openToday(): Promise<void> {
    const app = this.plugin.app
    const known = findJournalFolderPaths(app)
    const folders = resolveTodayFolders(known, (p) =>
      this.#isFolderIncluded(p)
    )
    if (folders.length === 0) {
      new Notice('No journal folders found.')
      return
    }
    if (folders.length === 1) {
      await this.#openTodayInFolder(folders[0])
      return
    }
    new TodayFolderPickerModal(app, folders, (p) =>
      this.#openTodayInFolder(p)
    ).open()
  }

  // Resolves a folder's effective `includeInTodayPicker` via its
  // `journal-folder.md` front matter (the config note's parent is the folder,
  // so `getSettings(configFile)` layers the folder override over the global
  // default). Front-matter booleans may arrive as strings, hence
  // `isTruthySetting`.
  #isFolderIncluded(folderPath: string): boolean {
    const configFile = this.plugin.app.vault.getAbstractFileByPath(
      configPathFor(folderPath)
    )
    const file = configFile instanceof TFile ? configFile : null
    return isTruthySetting(this.getSettings(file).includeInTodayPicker)
  }

  // Opens (creating on first visit, exactly like clicking the calendar's
  // Today cell) the current day's note for the folder. Today is the present,
  // so no "create a past note?" confirmation is needed. The link carries the
  // full folder path and resolves against the folder's config note, matching
  // the navigation the calendar/header use.
  async #openTodayInFolder(folderPath: string): Promise<void> {
    const basename = moment().format('YYYY-MM-DD')
    const link =
      folderPath === '' || folderPath === '/'
        ? basename
        : normalizePath(`${folderPath}/${basename}`)
    await this.plugin.app.workspace.openLinkText(
      link,
      configPathFor(folderPath),
      false
    )
  }

  #reconcileRibbon(): void {
    const wantRibbon = this.globalSettings.todayButtonPlacement === 'ribbon'
    if (wantRibbon && !this.#ribbonEl) {
      this.#ribbonEl = this.plugin.addRibbonIcon(
        TODAY_RIBBON_ICON,
        "Open today's journal note",
        () => void this.openToday()
      )
    } else if (!wantRibbon && this.#ribbonEl) {
      this.#removeRibbon()
    }
  }

  #removeRibbon(): void {
    this.#ribbonEl?.remove()
    this.#ribbonEl = null
  }
}
