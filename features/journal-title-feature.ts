import { mount } from 'svelte'
import {PluginFeature} from "./plugin-feature"
import {ErrorMessage, JournalHeader} from "../ui/components"
import type JournalFolderPlugin from "../main"
import type {TFile} from "obsidian"
import {createJournalFile} from "./journal-file";

// noinspection ExceptionCaughtLocallyJS
export class JournalTitleFeature extends PluginFeature {

	load(plugin: JournalFolderPlugin) {
		plugin.registerMarkdownCodeBlockProcessor("journal-title", (source, el, ctx) => {
			try {
				const file : TFile | null = plugin.app.metadataCache.getFirstLinkpathDest(ctx.sourcePath, "")
				if (!file) throw Error(`File not found - ${ctx.sourcePath}`);
				// @ts-ignore
				mount(JournalHeader, { target: el, props: { file: createJournalFile(file) } })
			} catch (error) {
				mount(ErrorMessage, { target: el, props: { error: `${error}`} })
			}
		})
	}
}
