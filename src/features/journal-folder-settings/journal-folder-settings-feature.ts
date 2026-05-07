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
  applyStartOfWeek,
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
  PluginFeature,
} from '../../data-access'
import type { Plugin } from 'obsidian'
import { JournalFolderSettingsTab } from './journal-folder-settings-tab'

export class JournalFolderSettingsFeature extends PluginFeature {
  constructor(
    plugin: Plugin,
    private propagateSettings: (settings: JournalFolderSettings) => void
  ) {
    super(plugin)
    this.useSettings(DEFAULT_SETTINGS)
  }

  async load(): Promise<void> {
    await this.updateSettingsFromStorage()

    this.plugin.addSettingTab(
      new JournalFolderSettingsTab(
        this.plugin,
        () => this.globalSettings,
        this.saveSettings
      )
    )
  }

  unload(): void {
    // Pull the body-class off if the plugin disables — leaving it set would
    // continue to hide journal-folder.md notes after the plugin is gone.
    document.body.classList.remove('journal-folder-hide-config-notes')
  }

  // Public so sibling features (e.g. the sidebar) can mutate global
  // settings without having to import the settings tab. The flow is the
  // same as edits made through the settings tab: persist → side-effects
  // (start-of-week, body classes) → broadcast.
  readonly saveSettings = async (
    settings: JournalFolderSettings
  ): Promise<void> => {
    await this.plugin.saveData(settings)
    applyStartOfWeek(settings.startOfWeek)
    document.body.classList.toggle(
      'journal-folder-hide-config-notes',
      !!settings.hideJournalFolderNotes
    )
    this.propagateSettings(settings)
  }

  readonly updateSettingsFromStorage = async (): Promise<void> => {
    const settings = {
      ...this.globalSettings,
      ...(await this.plugin.loadData()),
    }
    await this.saveSettings(settings)
  }

  readonly onExternalSettingsChange = this.updateSettingsFromStorage
}
