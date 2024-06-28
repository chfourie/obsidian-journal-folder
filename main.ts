import {Plugin, TFile} from 'obsidian';
import moment from "moment";
import {JournalTitleFeature, PluginFeatureSet} from "./features";
import {DEFAULT_SETTINGS, type JournalFolderSettings} from "./data-access/journal-folder-settings";

export default class JournalFolderPlugin extends Plugin {
	#settings: JournalFolderSettings = DEFAULT_SETTINGS

	#features: PluginFeatureSet = new PluginFeatureSet()
		.addFeature(new JournalTitleFeature())

	get settings(): JournalFolderSettings {
		return this.#settings;
	}

	async onload() {
		await this.loadSettings()
		this.#features.load(this)
	}

	onunload() {
		this.#features.unload(this)
	}

	getActiveFileMoment(): moment.Moment {
		return moment(this.getActiveFile().basename)
	}

	getActiveFile(): TFile {
		return this.app.workspace.getActiveFile()!;
	}

	createLink(el: HTMLElement, href: string, text: string) {
		return el.createEl("a", {href, text});
	}

	async loadSettings(): Promise<void> {
		this.#settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
}
