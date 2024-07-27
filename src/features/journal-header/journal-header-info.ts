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

import { type JournalFolderSettings, JournalNote, type Link } from '../../data-access'

export type JournalHeaderInfo = {
	title: string
	centerLinks: Link[]
	backwardLink: Link | undefined
	forwardLink: Link | undefined
	secondaryLinks: Link[]
	journalFolderTitle?: string
}

export function buildJournalHeaderInfo(settings: JournalFolderSettings, note: JournalNote): JournalHeaderInfo {
	return {
		title: note.getTitle(),
		centerLinks: buildCenterLinks(),
		backwardLink: createBackwardLink(),
		forwardLink: createForwardLink(),
		secondaryLinks: buildSecondaryLinks(),
		journalFolderTitle: settings.journalFolderTitle
	}

	function buildCenterLinks(): Link[] {
		const links = note
			.getHigherOrderNotes()
			.filter(n => n.isExistingNote() || n.isPresentOrFuture())
			.map(n => n.shortLinkFrom(note))

		if (!note.isToday()) {
			links.push(note.dailyNoteToday().linkWithTitlePattern('[Today]'))
		}

		return links
	}

	function createForwardLink(): Link | undefined {
		const directSibling = note.forwardInTime()

		if (directSibling.isExistingNote() || directSibling.isPresentOrFuture()) {
			return directSibling.shortLinkFrom(note)
		}

		const closestSibling = note.closestSibling('after')

		if (closestSibling) {
			return closestSibling.shortLinkFrom(note)
		}
	}

	function createBackwardLink(): Link | undefined {
		const directSibling = note.backInTime()

		if (directSibling.isExistingNote() || directSibling.isPresentOrFuture()) {
			return directSibling.shortLinkFrom(note)
		}

		return note.closestSibling('before')?.shortLinkFrom(note)
	}

	function buildSecondaryLinks(): Link[] {
		return note
			.getLowerOrderNotes()
			.map(n => n.link(
				'short',
				n.isMissingNote() && n.isPast(),
			))
	}
}
