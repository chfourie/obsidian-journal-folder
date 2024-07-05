import JournalFolderPlugin from '../plugin'
import type { JournalFolderSettings } from './journal-folder-settings.type'

// noinspection JSUnusedLocalSymbols
export abstract class PluginFeature {
	async load(_plugin: JournalFolderPlugin): Promise<void> {
	}

	unload(_plugin: JournalFolderPlugin): void {
	}

	useSettings(settings: JournalFolderSettings): void {
	}
}
