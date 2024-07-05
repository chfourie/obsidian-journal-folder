/*
Utilities for folder-based journaling in Obsidian
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
	type JournalFolderSettings,
	type JournalNoteFactory,
	journalNoteFactoryWithSettings,
	PluginFeature,
} from 'src/data-access'
import { ErrorMessage } from 'src/ui'
import JournalHeader from './JournalHeader.svelte'
import { buildJournalHeaderInfo } from './journal-header-info'
import type { Plugin } from 'obsidian'

export class JournalHeaderFeature extends PluginFeature {
	#journalNote: JournalNoteFactory | undefined

	constructor(plugin: Plugin) {
		super(plugin)
	}

	private get journalNote(): JournalNoteFactory {
		if (!this.#journalNote) throw new Error('Settings must be set')
		return this.#journalNote
	}


	useSettings(settings: JournalFolderSettings) {
		super.useSettings(settings)
		this.#journalNote = journalNoteFactoryWithSettings(settings)
	}

	async load() {
		this.plugin.registerMarkdownCodeBlockProcessor('journal-header', (_source, el, ctx) => {
			try {
				const note = this.journalNote(this.expectCurrentFile(ctx.sourcePath))
				const info = buildJournalHeaderInfo(note)
				// @ts-ignore
				mount(JournalHeader, { target: el, props: { info } })
			} catch (error) {
				console.error(error)
				mount(ErrorMessage, { target: el, props: { error: `${error}` } })
			}
		})
	}
}
