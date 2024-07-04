export type JournalFolderSettings = {
	dailyNoteTitlePattern: string
	dailyNoteShortTitlePattern: string
	weeklyNoteTitlePattern: string
	weeklyNoteShortTitlePattern: string
	monthlyNoteTitlePattern: string
	monthlyNoteShortTitlePattern: string
	yearlyNoteTitlePattern: string
	yearlyNoteShortTitlePattern: string
	showWeeklyLinks: boolean
	showMonthlyLinks: boolean
	showYearlyLinks: boolean
}

export const DEFAULT_SETTINGS: JournalFolderSettings = {
	dailyNoteTitlePattern: 'dddd, DD MMMM YYYY',
	dailyNoteShortTitlePattern: 'ddd, D MMM',
	weeklyNoteTitlePattern: 'YYYY [Week] w',
	weeklyNoteShortTitlePattern: '[W]ww',
	monthlyNoteTitlePattern: 'MMMM YYYY',
	monthlyNoteShortTitlePattern: 'MMM',
	yearlyNoteTitlePattern: 'YYYY',
	yearlyNoteShortTitlePattern: 'YYYY',
	showWeeklyLinks: true,
	showMonthlyLinks: true,
	showYearlyLinks: true
}
