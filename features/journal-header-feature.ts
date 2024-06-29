import { mount } from 'svelte'
import {PluginFeature} from "./plugin-feature"
import {ErrorMessage, JournalHeader} from "../ui/components"
import type JournalFolderPlugin from "../main"
import type {TFile} from "obsidian"
import {createJournalHeaderState} from "./journal-header-state";

// noinspection ExceptionCaughtLocallyJS
export class JournalHeaderFeature extends PluginFeature {

	load(plugin: JournalFolderPlugin) {
		plugin.registerMarkdownCodeBlockProcessor("journal-header", (source, el, ctx) => {
			try {
				const file : TFile | null = plugin.app.metadataCache.getFirstLinkpathDest(ctx.sourcePath, "")
				if (!file) throw Error(`File not found - ${ctx.sourcePath}`);
				// @ts-ignore
				mount(JournalHeader, { target: el, props: { state: createJournalHeaderState(file) } })
			} catch (error) {
				mount(ErrorMessage, { target: el, props: { error: `${error}`} })
			}
		})
	}
}
