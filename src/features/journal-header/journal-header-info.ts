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
  type JournalTimeUnit,
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
  // Optional supplementary section in the More panel for tiers that aren't
  // captured by the higher/lower-order chain. Currently used to surface the
  // four overlapping quarters on a yearly note when quarters are enabled —
  // the Month list stays as the primary lower-order section, and quarters
  // get their own row above it.
  extraLinks: Link[]
  extraLinksLabel: string
  journalFolderTitle?: string
}

export function buildJournalHeaderInfo(
  settings: JournalFolderSettings,
  note: JournalNote
): JournalHeaderInfo {
  const lowerOrderNotes = note.getLowerOrderNotes()
  const lowerOrderUnit = lowerOrderNotes[0]?.getTimeUnit()
  const extraSection = buildExtraSection()

  return {
    title: note.getTitle(),
    moreLinks: buildMoreLinks(),
    moreLinksLabel: 'Jump to',
    todayLink: buildTodayLink(),
    backwardLink: createBackwardLink(),
    forwardLink: createForwardLink(),
    secondaryLinks: buildSecondaryLinks(),
    secondaryLinksLabel: lowerOrderUnit ? labelFor(lowerOrderUnit) : '',
    extraLinks: extraSection.links,
    extraLinksLabel: extraSection.label,
    journalFolderTitle: buildJournalFolderTitle(),
  }

  // Yearly notes get a Quarter section above the Month list when quarters
  // are enabled. Other note types either already see quarters in the
  // higher-order chain (daily/weekly/monthly) or in their primary
  // lower-order list (quarterly→months), so they don't need an extra row.
  function buildExtraSection(): { links: Link[]; label: string } {
    if (note.getTimeUnit() !== 'year') return { links: [], label: '' }
    const quarters = note.getNotesInPeriod('quarter')
    if (quarters.length === 0) return { links: [], label: '' }
    const pattern = secondaryTitlePatternFor('quarter')
    return {
      label: labelFor('quarter'),
      links: quarters.map((n) =>
        n.linkWithTitlePattern(pattern, n.isMissingNote() && n.isPast())
      ),
    }
  }
  // Note: the `(n.isMissingNote() && n.isPast())` argument flags past+missing
  // entries so NoteLink can route them through the create-confirmation modal.
  // Future-missing entries stay as plain links — Obsidian's normal "open or
  // create" path applies, no prompt needed.

  function buildJournalFolderTitle(): string | undefined {
    if (settings.journalFolderTitle) {
      return settings.journalFolderTitle
    } else if (settings.useFolderNameAsDefaultTitle) {
      return note.getFolderName()
    }
  }

  function buildMoreLinks(): Link[] {
    // Higher-order notes come back in descending tier order (year, quarter,
    // month, week). When the current note spans a boundary at a tier the
    // chain returns two adjacent entries for that tier (e.g. a week that
    // crosses a quarter end gives Q1 and Q2). For those spanning cases we
    // want every overlapping period visible — past+missing ones get the
    // confirmation flag so clicking them prompts before creating, mirroring
    // the secondary list. For single-entry tiers we keep the existing
    // filter so present-time pages don't show a long tail of past-and-empty
    // containers.
    const higher = note.getHigherOrderNotes()
    const tiers: JournalNote[][] = []
    for (const n of higher) {
      const last = tiers[tiers.length - 1]
      if (last && last[0].getTimeUnit() === n.getTimeUnit()) last.push(n)
      else tiers.push([n])
    }

    const links: Link[] = []
    for (const tier of tiers) {
      if (tier.length > 1) {
        for (const n of tier) {
          links.push(n.link('regular', n.isMissingNote() && n.isPast()))
        }
      } else {
        const [n] = tier
        if (n.isExistingNote() || n.isPresentOrFuture()) {
          links.push(n.link('regular'))
        }
      }
    }
    return links
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

function secondaryTitlePatternFor(unit: JournalTimeUnit): string {
  // The header already shows the year, so secondary patterns drop it.
  // Non-breaking spaces (U+00A0) keep each label on a single line in the grid.
  switch (unit) {
    case 'day':
      return 'ddd, DD MMMM'
    case 'week':
      return '[Week] w'
    case 'month':
      return 'MMMM'
    case 'quarter':
      return '[Q]Q'
    case 'year':
      return 'YYYY'
  }
}

function labelFor(unit: JournalTimeUnit): string {
  switch (unit) {
    case 'day':
      return 'Day'
    case 'week':
      return 'Week'
    case 'month':
      return 'Month'
    case 'quarter':
      return 'Quarter'
    case 'year':
      return 'Year'
  }
}
