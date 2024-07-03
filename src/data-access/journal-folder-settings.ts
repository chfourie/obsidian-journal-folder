export interface JournalFolderSettings {
	dailyFolder: string
	weeklyFolder: string
	monthlyFolder: string
}

export const DEFAULT_SETTINGS: JournalFolderSettings = {
	dailyFolder: 'Journal/Daily',
	weeklyFolder: 'Journal/Weekly',
	monthlyFolder: 'Journal/Monthly',
}
