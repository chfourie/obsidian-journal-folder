import type JournalFolderPlugin from "../main";

export abstract class PluginFeature {
	load(plugin: JournalFolderPlugin): void {}
	unload(plugin: JournalFolderPlugin): void {}
}
