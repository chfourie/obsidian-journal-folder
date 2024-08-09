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

  private readonly saveSettings = async (
    settings: JournalFolderSettings
  ): Promise<void> => {
    await this.plugin.saveData(settings)
    this.propagateSettings(settings)
  }

  readonly updateSettingsFromStorage = async (): Promise<void> => {
    const settings = {
      ...this.globalSettings,
      ...(await this.plugin.loadData()),
      journalFolderTitle: '',
    }

    await this.saveSettings(settings)
  }

  readonly onExternalSettingsChange = this.updateSettingsFromStorage
}
