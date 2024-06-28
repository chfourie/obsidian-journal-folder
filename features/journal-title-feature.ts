import { mount } from 'svelte'
import {PluginFeature} from "./plugin-feature";
import {ErrorMessage, JournalTitle} from "../ui/components";
import type JournalFolderPlugin from "../main";

export class JournalTitleFeature extends PluginFeature {

	load(plugin: JournalFolderPlugin) {
		plugin.registerMarkdownCodeBlockProcessor("journal-title", (source, el, ctx) => {
			try {
				mount(JournalTitle, { target: el });
			} catch (error) {
				mount(ErrorMessage, { target: el, props: { error: `${error}`} });
			}
		})
	}
}
