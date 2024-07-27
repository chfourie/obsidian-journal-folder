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

import { App, Plugin, type PluginManifest } from 'obsidian'
import { PluginFeatureSet } from './plugin-feature-set'
import { JournalHeaderFeature } from '../features/journal-header'
import { JournalFolderSettingsFeature } from '../features/journal-folder-settings'

export default class JournalFolderPlugin extends Plugin {
  readonly #features: PluginFeatureSet = new PluginFeatureSet()

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)

    this.#features
      .addFeature(
        new JournalFolderSettingsFeature(this, this.#features.useSettings)
      )
      .addFeature(new JournalHeaderFeature(this))
  }

  readonly onExternalSettingsChange = this.#features.onExternalSettingsChange
  readonly onload = this.#features.load
  readonly unload = this.#features.unload
}
