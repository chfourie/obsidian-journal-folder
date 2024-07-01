import type JournalFolderPlugin from '../main'

// noinspection JSUnusedLocalSymbols
export abstract class PluginFeature {
	load(plugin: JournalFolderPlugin): void {
	}

	unload(plugin: JournalFolderPlugin): void {
	}
}
