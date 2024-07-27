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
	dailyNoteMediumTitlePattern: string
	weeklyNoteTitlePattern: string
	weeklyNoteShortTitlePattern: string
	weeklyNoteMediumTitlePattern: string
	monthlyNoteTitlePattern: string
	monthlyNoteShortTitlePattern: string
	monthlyNoteMediumTitlePattern: string
	yearlyNoteTitlePattern: string
	yearlyNoteShortTitlePattern: string
	yearlyNoteMediumTitlePattern: string
	journalFolderTitle?: string
}

export const DEFAULT_SETTINGS: JournalFolderSettings = {
	dailyNoteTitlePattern: 'dddd, DD MMMM YYYY',
	dailyNoteShortTitlePattern: 'ddd, D MMM',
	dailyNoteMediumTitlePattern: 'ddd, D MMM YY',
	weeklyNoteTitlePattern: 'gggg [Week] w',
	weeklyNoteShortTitlePattern: '[W]ww',
	weeklyNoteMediumTitlePattern: '[W]ww gg',
	monthlyNoteTitlePattern: 'MMMM YYYY',
	monthlyNoteShortTitlePattern: 'MMM',
	monthlyNoteMediumTitlePattern: 'MMM YY',
	yearlyNoteTitlePattern: 'YYYY',
	yearlyNoteShortTitlePattern: 'YYYY',
	yearlyNoteMediumTitlePattern: 'YYYY',
}
