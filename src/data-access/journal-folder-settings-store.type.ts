import type { JournalFolderSettings } from './journal-folder-settings.type'

export type JournalFolderSettingsStore = {
	saveToStorage: (settings: JournalFolderSettings) => Promise<void>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	loadFromStorage: () => Promise<any>
}
