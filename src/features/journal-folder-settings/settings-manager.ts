import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../../data-access'

export type SettingsManagerSupport = {
	saveToStorage: (settings: JournalFolderSettings) => Promise<void>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	loadFromStorage: () => Promise<any>
	useSettings: (settings: JournalFolderSettings) => void
}

export class SettingsManager {
	#settings: JournalFolderSettings = DEFAULT_SETTINGS
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private readonly loadFromStorage: () => Promise<any>
	private readonly saveToStorage: (settings: JournalFolderSettings) => Promise<void>
	private readonly useSettings: (settings: JournalFolderSettings) => void

	constructor(ctx: SettingsManagerSupport) {
		this.saveToStorage = ctx.saveToStorage
		this.loadFromStorage = ctx.loadFromStorage
		this.useSettings = ctx.useSettings
	}

	readonly updateSettingsFromStorage = async (): Promise<void> => {
		this.#settings = {...this.#settings, ...await this.loadFromStorage()}
		await this.saveSettings()
		this.useSettings(this.#settings)
	}

	private async saveSettings(): Promise<void> {
		await this.saveToStorage(this.#settings)
	}
}
