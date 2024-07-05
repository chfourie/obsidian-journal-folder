/*
Utilities for folder-based journaling in Obsidian
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

import { JournalNote, type Link } from '../../data-access'

export type JournalHeaderInfo = {
	title: string
	centerLinks: Link[]
	backwardLink: Link | undefined
	forwardLink: Link | undefined
	secondaryLinks: Link[]
}

export function buildJournalHeaderInfo(note: JournalNote): JournalHeaderInfo {
	return {
		title: note.getTitle(),
		centerLinks: buildCenterLinks(),
		backwardLink: createSiblingLink('before'),
		forwardLink: createSiblingLink('after'),
		secondaryLinks: buildSecondaryLinks(),
	}

	function buildCenterLinks(): Link[] {
		const links = note
			.getHigherOrderNotes()
			.filter(note => note.isExistingNote() || note.isPresentOrFuture())
			.map(note => note.link())

		if (!note.isToday()) {
			links.push(note.dailyNoteToday().linkWithTitlePattern('[Today]'))
		}

		return links
	}

	function createSiblingLink(beforeOrAfter: 'before' | 'after'): Link | undefined {
		const directSibling = beforeOrAfter === 'before' ? note.backInTime() : note.forwardInTime()

		if (directSibling.isExistingNote() || directSibling.isPresentOrFuture()) {
			return directSibling.link()
		}

		return note.closestSibling(beforeOrAfter)?.link()
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
