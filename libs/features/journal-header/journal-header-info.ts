import { journalNote, type Link } from '@journal-folder/data-access'
import type { TFile } from 'obsidian'

export type JournalHeaderInfo = {
	title: string
	centerLinks: Link[]
	backwardLink: Link | undefined
	forwardLink: Link | undefined
	secondaryLinks: Link[]
}

export function buildJournalHeaderInfo(file: TFile): JournalHeaderInfo {
	const note = journalNote(file)

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

		if (!note.isPresentTime()) {
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
		return []
	}
}
