import type { JournalFolderSettings } from './journal-folder-settings.type'
import type { Plugin, TFile } from 'obsidian'

// noinspection JSUnusedLocalSymbols
export abstract class PluginFeature {
	#settings: JournalFolderSettings | undefined

	constructor(protected plugin: Plugin) {
	}

	protected get settings() {
		if (!this.#settings) throw new Error('Settings must be set')
		return this.#settings
	}

	async load(): Promise<void> {
	}

	unload(): void {
	}

	useSettings(settings: JournalFolderSettings): void {
		this.#settings = settings
	}

	getCurrentFile(linkPath: string, sourcePath = ''): TFile | null {
		return this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)
	}

	expectCurrentFile(linkPath: string, sourcePath = ''): TFile {
		const file: TFile | null = this.getCurrentFile(linkPath, sourcePath)
		if (!file) throw Error(`Current not found (linkPath: ${sourcePath}, sourcePath: ${sourcePath})`)
		return file
	}
}
