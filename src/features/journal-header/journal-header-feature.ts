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
		super.useSettings(settings);
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
