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

import {
  type JournalFolderSettings,
  JournalNote,
  type Link,
} from '../../data-access'

export type JournalHeaderInfo = {
  title: string
  moreLinks: Link[]
  moreLinksLabel: string
  todayLink: Link | undefined
  backwardLink: Link | undefined
  forwardLink: Link | undefined
  secondaryLinks: Link[]
  secondaryLinksLabel: string
  journalFolderTitle?: string
}

export function buildJournalHeaderInfo(
  settings: JournalFolderSettings,
  note: JournalNote
): JournalHeaderInfo {
  const lowerOrderNotes = note.getLowerOrderNotes()
  const lowerOrderUnit = lowerOrderNotes[0]?.getTimeUnit()

  return {
    title: note.getTitle(),
    moreLinks: buildMoreLinks(),
    moreLinksLabel: 'View',
    todayLink: buildTodayLink(),
    backwardLink: createBackwardLink(),
    forwardLink: createForwardLink(),
    secondaryLinks: buildSecondaryLinks(),
    secondaryLinksLabel: lowerOrderUnit ? labelFor(lowerOrderUnit) : '',
    journalFolderTitle: buildJournalFolderTitle(),
  }

  function buildJournalFolderTitle(): string | undefined {
    if (settings.journalFolderTitle) {
      return settings.journalFolderTitle
    } else if (settings.useFolderNameAsDefaultTitle) {
      return note.getFolderName()
    }
  }

  function buildMoreLinks(): Link[] {
    return note
      .getHigherOrderNotes()
      .filter((n) => n.isExistingNote() || n.isPresentOrFuture())
      .map((n) => n.link('regular'))
  }

  function buildTodayLink(): Link | undefined {
    if (note.isToday()) return undefined
    return note.dailyNoteToday().linkWithTitlePattern('[Today]')
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
    if (!lowerOrderUnit) return []
    const pattern = secondaryTitlePatternFor(lowerOrderUnit)
    return lowerOrderNotes.map((n) =>
      n.linkWithTitlePattern(pattern, n.isMissingNote() && n.isPast())
    )
  }
}

function secondaryTitlePatternFor(
  unit: 'day' | 'week' | 'month' | 'year'
): string {
  // The header already shows the year, so secondary patterns drop it.
  // Non-breaking spaces (U+00A0) keep each label on a single line in the grid.
  switch (unit) {
    case 'day':
      return 'ddd, DD MMMM'
    case 'week':
      return '[Week] w'
    case 'month':
      return 'MMMM'
    case 'year':
      return 'YYYY'
  }
}

function labelFor(unit: 'day' | 'week' | 'month' | 'year'): string {
  switch (unit) {
    case 'day':
      return 'Day'
    case 'week':
      return 'Week'
    case 'month':
      return 'Month'
    case 'year':
      return 'Year'
  }
}
