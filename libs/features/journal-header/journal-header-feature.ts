import { mount } from 'svelte'
import type { TFile } from 'obsidian'
import type { JournalFolderPlugin } from '@journal-folder/plugin'
import { PluginFeature } from 'libs/data-access'
import { ErrorMessage } from 'libs/ui'
import { createJournalHeaderState } from './journal-header-state'
import JournalHeader from './JournalHeader.svelte'

// noinspection ExceptionCaughtLocallyJS
export class JournalHeaderFeature extends PluginFeature {

	load(plugin: JournalFolderPlugin) {
		plugin.registerMarkdownCodeBlockProcessor('journal-header', (source, el, ctx) => {
			try {
				const file: TFile | null = plugin.app.metadataCache.getFirstLinkpathDest(ctx.sourcePath, '')
				if (!file) throw Error(`File not found - ${ctx.sourcePath}`)
				// @ts-ignore
				mount(JournalHeader, { target: el, props: { state: createJournalHeaderState(file) } })
			} catch (error) {
				mount(ErrorMessage, { target: el, props: { error: `${error}` } })
			}
		})
	}
}
