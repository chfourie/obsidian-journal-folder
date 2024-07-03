import { JournalFolderPlugin } from '../plugin'

export abstract class PluginFeature {
	load(plugin: JournalFolderPlugin): void {
	}

	unload(plugin: JournalFolderPlugin): void {
	}
}
