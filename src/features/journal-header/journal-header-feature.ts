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

import { mount } from 'svelte'
import {
	JournalNote,
	journalNoteFactoryWithSettings,
	PluginFeature,
} from 'src/data-access'
import { ErrorMessage } from 'src/ui'
import JournalHeader from './JournalHeader.svelte'
import { buildJournalHeaderInfo } from './journal-header-info'
import type { Plugin, TFile } from 'obsidian'

export class JournalHeaderFeature extends PluginFeature {

	constructor(plugin: Plugin) {
		super(plugin)
	}

	getJournalNote(file: TFile, embeddedConfig = ''): JournalNote {
		return journalNoteFactoryWithSettings(this.getSettings(file, embeddedConfig))(file)
	}

	async load() {
		this.plugin.registerMarkdownCodeBlockProcessor('journal-header', (source, el, ctx) => {
			try {
				const note = this.getJournalNote(this.expectCurrentFile(ctx.sourcePath), source)
				const info = buildJournalHeaderInfo(note)
				// @ts-ignore
				mount(JournalHeader, { target: el, props: { info } })
			} catch (error) {
				mount(ErrorMessage, { target: el, props: { error: `${error}` } })
			}
		})
	}
}
