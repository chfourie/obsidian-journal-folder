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
				n.isMissingNote() && n.isPast()
			))
	}
}