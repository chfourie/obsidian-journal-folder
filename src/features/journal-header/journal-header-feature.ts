import { mount } from 'svelte'
import type { TFile } from 'obsidian'
import { journalNoteFactoryWithSettings, PluginFeature } from 'src/data-access'
import { ErrorMessage } from 'src/ui'
import JournalHeader from './JournalHeader.svelte'
import { buildJournalHeaderInfo } from './journal-header-info'
import type JournalFolderPlugin from '../../plugin/journal-folder-plugin'

// noinspection ExceptionCaughtLocallyJS
export class JournalHeaderFeature extends PluginFeature {

	load(plugin: JournalFolderPlugin) {
		const journalNote = journalNoteFactoryWithSettings(plugin.settings)
		plugin.registerMarkdownCodeBlockProcessor('journal-header', (source, el, ctx) => {
			try {
				const file: TFile | null = plugin.app.metadataCache.getFirstLinkpathDest(ctx.sourcePath, '')
				if (!file) throw Error(`File not found - ${ctx.sourcePath}`)
				// @ts-ignore
				mount(JournalHeader, { target: el, props: { info: buildJournalHeaderInfo(journalNote(file)) } })
			} catch (error) {
				console.error(error)
				mount(ErrorMessage, { target: el, props: { error: `${error}` } })
			}
		})
	}
}
