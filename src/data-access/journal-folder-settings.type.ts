/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

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
	weeklyNoteTitlePattern: 'gggg [Week] w',
	weeklyNoteShortTitlePattern: '[W]ww',
	monthlyNoteTitlePattern: 'MMMM YYYY',
	monthlyNoteShortTitlePattern: 'MMM',
	yearlyNoteTitlePattern: 'YYYY',
	yearlyNoteShortTitlePattern: 'YYYY',
	showWeeklyLinks: true,
	showMonthlyLinks: true,
	showYearlyLinks: true,
}
