import JournalFolderPlugin from '../plugin'

// noinspection JSUnusedLocalSymbols
export abstract class PluginFeature {
	load(_plugin: JournalFolderPlugin): void {
	}

	unload(_plugin: JournalFolderPlugin): void {
	}
}
