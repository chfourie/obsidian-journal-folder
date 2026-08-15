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

import { normalizePath, type TFile } from 'obsidian'
import type { JournalFolderSettings, Link } from './index'
import { moment } from './moment'

export type JournalTimeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year'

type JournalNoteStrategy = {
  fileRegex: RegExp
  filePattern: string
  titlePattern: string
  shortTitlePattern: string
  mediumTitlePattern: string
  yearPattern: string
  timeUnit: JournalTimeUnit
}

type JournalNoteStrategies = {
  DAILY_NOTE_STRATEGY: JournalNoteStrategy
  WEEKLY_NOTE_STRATEGY: JournalNoteStrategy
  MONTHLY_NOTE_STRATEGY: JournalNoteStrategy
  QUARTERLY_NOTE_STRATEGY: JournalNoteStrategy
  YEARLY_NOTE_STRATEGY: JournalNoteStrategy
  BY_DESCENDING_ORDER: JournalNoteStrategy[]
}

// The exact slice of `TFile` the factory reads: the basename (strategy
// selection + the note's moment) and the parent folder (name, path, and —
// lazily — the sibling note names via `parent.children`). Typed structurally
// so callers that need a journal note for a file that doesn't exist on disk
// (sidebar anchor, template preview) can pass a plain object instead of
// casting to `TFile` — Obsidian's real `TFile` constructor can't take a
// post-hoc path.
export interface JournalNoteSource {
  basename: string
  parent: TFile['parent']
}

export type JournalNoteFactory = (file: JournalNoteSource) => JournalNote

// Regex tier for the basename — matches the strategies built below. Quarterly
// is gated behind a setting because we don't want a folder using `2026-Q1`
// for something else to accidentally be treated as a journal note.
const JOURNAL_FILE_REGEXES_NO_QUARTERS = [
  /^[12]\d{3}-((0[1-9])|(1[012]))-(([0-2][0-9])|(3[01]))$/,
  /^[12]\d{3}-W((0[1-9])|([1-4][0-9])|(5[0-3]))$/,
  /^[12]\d{3}-((0[1-9])|(1[012]))$/,
  /^[12]\d{3}$/,
]
const JOURNAL_FILE_QUARTERLY_REGEX = /^[12]\d{3}-Q[1-4]$/

export function isJournalFileBasename(
  basename: string,
  quartersEnabled: boolean
): boolean {
  if (JOURNAL_FILE_REGEXES_NO_QUARTERS.some((r) => r.test(basename))) return true
  return quartersEnabled && JOURNAL_FILE_QUARTERLY_REGEX.test(basename)
}

// Returns the journal time unit a basename represents, or `null` when the
// basename isn't a recognised journal pattern. Quarters resolve to `null`
// unless `quartersEnabled` is true. Mirrors the regexes used by
// `isJournalFileBasename`.
export function journalUnitForBasename(
  basename: string,
  quartersEnabled: boolean
): JournalTimeUnit | null {
  if (/^[12]\d{3}-((0[1-9])|(1[012]))-(([0-2][0-9])|(3[01]))$/.test(basename))
    return 'day'
  if (/^[12]\d{3}-W((0[1-9])|([1-4][0-9])|(5[0-3]))$/.test(basename))
    return 'week'
  if (/^[12]\d{3}-((0[1-9])|(1[012]))$/.test(basename)) return 'month'
  if (quartersEnabled && JOURNAL_FILE_QUARTERLY_REGEX.test(basename))
    return 'quarter'
  if (/^[12]\d{3}$/.test(basename)) return 'year'
  return null
}

function startOfInterval(
  sourceMoment: moment.Moment,
  pattern: string
): moment.Moment {
  // @ts-ignore
  return moment(sourceMoment.format(pattern), pattern)
}

// Lazily-computed snapshot of the note names in one folder. A scope walk
// (task candidates, migration pickers) builds a JournalNote per file but
// never calls the existence APIs, so the folder's children are not read at
// all unless `isExistingNote`/`closestSibling` actually run — and then at
// most once: the snapshot is shared by every note in the folder within one
// factory instance and by every note derived via createNote /
// createNoteOfSameTimeUnit. The Set view backs the per-calendar-cell
// existence lookup; the array view stays for closestSibling's ordered scan.
class FolderNamesSnapshot {
  private names: string[] | undefined
  private nameSet: Set<string> | undefined

  constructor(private readonly compute: () => string[]) {}

  getNames(): string[] {
    if (!this.names) this.names = this.compute()
    return this.names
  }

  has(name: string): boolean {
    if (!this.nameSet) this.nameSet = new Set(this.getNames())
    return this.nameSet.has(name)
  }
}

// Folder front-matter and embedded code-block configs arrive as raw values,
// so a boolean setting can show up as a real boolean (YAML), the string
// "true"/"false" (embedded `key: value`), or anything else a user typed.
// Match the convention in resolve-default-calendar-visible: only the literal
// string "false" is falsy on the string path; otherwise defer to JS truthiness.
function isTruthySetting(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().toLowerCase() !== 'false'
  return Boolean(value)
}

export function journalNoteFactoryWithSettings(
  settings: JournalFolderSettings
): JournalNoteFactory {
  const DAILY_NOTE_STRATEGY: JournalNoteStrategy = {
    fileRegex: /^[12]\d{3}-((0[1-9])|(1[012]))-(([0-2][0-9])|(3[01]))$/,
    filePattern: 'YYYY-MM-DD',
    titlePattern: settings.dailyNoteTitlePattern,
    shortTitlePattern: settings.dailyNoteShortTitlePattern,
    mediumTitlePattern: settings.dailyNoteMediumTitlePattern,
    yearPattern: 'YYYY',
    timeUnit: 'day',
  }

  const WEEKLY_NOTE_STRATEGY: JournalNoteStrategy = {
    fileRegex: /^[12]\d{3}-W((0[1-9])|([1-4][0-9])|(5[0-3]))$/,
    filePattern: 'gggg-[W]ww',
    titlePattern: settings.weeklyNoteTitlePattern,
    shortTitlePattern: settings.weeklyNoteShortTitlePattern,
    mediumTitlePattern: settings.weeklyNoteMediumTitlePattern,
    yearPattern: 'gggg',
    timeUnit: 'week',
  }

  const MONTHLY_NOTE_STRATEGY: JournalNoteStrategy = {
    fileRegex: /^[12]\d{3}-((0[1-9])|(1[012]))$/,
    filePattern: 'YYYY-MM',
    titlePattern: settings.monthlyNoteTitlePattern,
    shortTitlePattern: settings.monthlyNoteShortTitlePattern,
    mediumTitlePattern: settings.monthlyNoteMediumTitlePattern,
    yearPattern: 'YYYY',
    timeUnit: 'month',
  }

  const QUARTERLY_NOTE_STRATEGY: JournalNoteStrategy = {
    fileRegex: /^[12]\d{3}-Q[1-4]$/,
    filePattern: 'YYYY-[Q]Q',
    titlePattern: settings.quarterlyNoteTitlePattern,
    shortTitlePattern: settings.quarterlyNoteShortTitlePattern,
    mediumTitlePattern: settings.quarterlyNoteMediumTitlePattern,
    yearPattern: 'YYYY',
    timeUnit: 'quarter',
  }

  const YEARLY_NOTE_STRATEGY: JournalNoteStrategy = {
    fileRegex: /^[12]\d{3}$/,
    filePattern: 'YYYY',
    titlePattern: settings.yearlyNoteTitlePattern,
    shortTitlePattern: settings.yearlyNoteShortTitlePattern,
    mediumTitlePattern: settings.yearlyNoteMediumTitlePattern,
    yearPattern: 'YYYY',
    timeUnit: 'year',
  }

  // Quarters are an opt-in tier — when disabled they're absent from the
  // descending-order chain so quarter files don't get picked up as journal
  // notes and don't show up in higher/lower-order traversals.
  const quartersEnabled = isTruthySetting(settings.quartersEnabled)
  const BY_DESCENDING_ORDER: JournalNoteStrategy[] = quartersEnabled
    ? [
        YEARLY_NOTE_STRATEGY,
        QUARTERLY_NOTE_STRATEGY,
        MONTHLY_NOTE_STRATEGY,
        WEEKLY_NOTE_STRATEGY,
        DAILY_NOTE_STRATEGY,
      ]
    : [
        YEARLY_NOTE_STRATEGY,
        MONTHLY_NOTE_STRATEGY,
        WEEKLY_NOTE_STRATEGY,
        DAILY_NOTE_STRATEGY,
      ]

  const strategies: JournalNoteStrategies = {
    DAILY_NOTE_STRATEGY,
    WEEKLY_NOTE_STRATEGY,
    MONTHLY_NOTE_STRATEGY,
    QUARTERLY_NOTE_STRATEGY,
    YEARLY_NOTE_STRATEGY,
    BY_DESCENDING_ORDER,
  }

  function getNoteStrategy(file: JournalNoteSource): JournalNoteStrategy {
    const buildStrategy = strategies.BY_DESCENDING_ORDER.filter((s) =>
      s.fileRegex.test(file.basename)
    ).first()

    if (!buildStrategy)
      throw new Error(
        `File name does not represent a valid journal file - ${file.basename}`
      )

    return buildStrategy
  }

  // One snapshot per folder per factory instance — a factory lives for
  // exactly one walk/render, so files sharing a parent share one (lazy)
  // children scan instead of paying O(folder size) per note.
  const snapshotsByFolder = new Map<unknown, FolderNamesSnapshot>()
  function snapshotFor(parent: JournalNoteSource['parent']): FolderNamesSnapshot {
    let snapshot = snapshotsByFolder.get(parent)
    if (!snapshot) {
      snapshot = new FolderNamesSnapshot(() =>
        (parent?.children || []).map((f) => f.name.replace(/\.md$/, ''))
      )
      snapshotsByFolder.set(parent, snapshot)
    }
    return snapshot
  }

  // `startOfInterval(today, pattern)` is identical for every file in a
  // walk, so memoise it per strategy. Keyed on today's value so a factory
  // that happens to straddle midnight still resolves the new day.
  let presentCacheDay: number | undefined
  const presentByStrategy = new Map<JournalNoteStrategy, moment.Moment>()
  function presentFor(
    today: moment.Moment,
    strategy: JournalNoteStrategy
  ): moment.Moment {
    if (presentCacheDay !== today.valueOf()) {
      presentByStrategy.clear()
      presentCacheDay = today.valueOf()
    }
    let present = presentByStrategy.get(strategy)
    if (!present) {
      present = startOfInterval(today, strategy.filePattern)
      presentByStrategy.set(strategy, present)
    }
    return present
  }

  return function journalNote(file: JournalNoteSource): JournalNote {
    const strategy = getNoteStrategy(file)
    // @ts-ignore
    const today = moment().startOf('day')

    return new JournalNote(
      strategies,
      file.parent?.name,
      file.parent?.path || '',
      snapshotFor(file.parent),
      strategy,
      // @ts-ignore
      moment(file.basename, strategy.filePattern),
      presentFor(today, strategy),
      today
    )
  }
}

export class JournalNote {
  private readonly name: string
  private readonly lastDay: moment.Moment

  constructor(
    private strategies: JournalNoteStrategies,
    private folderName: string | undefined,
    private path: string,
    private siblings: FolderNamesSnapshot,
    private strategy: JournalNoteStrategy,
    private fileMoment: moment.Moment,
    private present: moment.Moment,
    private today: moment.Moment
  ) {
    this.name = fileMoment.format(this.strategy.filePattern)
    this.lastDay = fileMoment
      .clone()
      .add(1, strategy.timeUnit)
      .subtract(1, 'day')
  }

  getTitle(): string {
    return this.fileMoment.format(this.strategy.titlePattern)
  }

  getTimeUnit(): JournalTimeUnit {
    return this.strategy.timeUnit
  }

  getMoment(): moment.Moment {
    return this.fileMoment.clone()
  }

  // True when the given time unit has a strategy registered in the
  // descending-order chain. Used by the calendar to decide whether to render
  // the quarter suffix without threading an extra prop down from settings.
  hasUnit(unit: JournalTimeUnit): boolean {
    return this.strategies.BY_DESCENDING_ORDER.includes(this.strategyFor(unit))
  }

  noteFor(unit: JournalTimeUnit, m: moment.Moment): JournalNote {
    return this.createNote(this.strategyFor(unit), m)
  }

  private strategyFor(unit: JournalTimeUnit): JournalNoteStrategy {
    switch (unit) {
      case 'day':
        return this.strategies.DAILY_NOTE_STRATEGY
      case 'week':
        return this.strategies.WEEKLY_NOTE_STRATEGY
      case 'month':
        return this.strategies.MONTHLY_NOTE_STRATEGY
      case 'quarter':
        return this.strategies.QUARTERLY_NOTE_STRATEGY
      case 'year':
        return this.strategies.YEARLY_NOTE_STRATEGY
    }
  }

  forwardInTime(): JournalNote {
    const moment = this.fileMoment.clone().add(1, this.strategy.timeUnit)
    return this.createNoteOfSameTimeUnit(moment)
  }

  backInTime(): JournalNote {
    const moment = this.fileMoment.clone().subtract(1, this.strategy.timeUnit)
    return this.createNoteOfSameTimeUnit(moment)
  }

  // noinspection JSUnusedGlobalSymbols
  presentNote(): JournalNote {
    return this.createNoteOfSameTimeUnit(this.present)
  }

  dailyNoteToday(): JournalNote {
    return this.createNote(this.strategies.DAILY_NOTE_STRATEGY, this.today)
  }

  // noinspection JSUnusedGlobalSymbols
  isFuture(): boolean {
    return this.fileMoment.isAfter(this.present)
  }

  // noinspection JSUnusedGlobalSymbols
  isPast(): boolean {
    return this.fileMoment.isBefore(this.present, this.strategy.timeUnit)
  }

  isPresentTime(): boolean {
    return this.fileMoment.isSame(this.present, this.strategy.timeUnit)
  }

  isPresentOrFuture(): boolean {
    return this.fileMoment.isSameOrAfter(this.present, this.strategy.timeUnit)
  }

  isExistingNote(): boolean {
    return this.siblings.has(this.name)
  }

  isToday(): boolean {
    return this.strategy.timeUnit === 'day' && this.isPresentTime()
  }

  // noinspection JSUnusedGlobalSymbols
  isMissingNote(): boolean {
    return !this.isExistingNote()
  }

  getHigherOrderNotes(): JournalNote[] {
    const notes: JournalNote[] = []

    for (const strategy of this.strategies.BY_DESCENDING_ORDER) {
      if (this.strategy === strategy) break
      const note = this.createNote(strategy)
      notes.push(note)
      const note2 = this.createNote(strategy, this.lastDay)
      if (!note2.sameNoteAs(note)) notes.push(note2)
    }

    return notes
  }

  private sameNoteAs(note: JournalNote): boolean {
    return (
      note.strategy === this.strategy &&
      note.fileMoment.isSame(this.fileMoment, 'day')
    )
  }

  getLowerOrderNotes(): JournalNote[] {
    const lowerOrderStrategy = this.getLowerOrderStrategy()
    return lowerOrderStrategy ? this.notesInPeriodFor(lowerOrderStrategy) : []
  }

  // Returns the list of notes for the requested unit that fall within this
  // note's interval. Used to surface a separate "Quarter" section on yearly
  // notes (4 quarters) without disturbing the existing primary lower-order
  // list (12 months). Returns [] when the requested unit is not active in
  // the descending-order chain — e.g. asking for 'quarter' when quarters
  // are disabled — or when the unit is the same as or higher than the
  // current note's tier.
  getNotesInPeriod(unit: JournalTimeUnit): JournalNote[] {
    const strategy = this.strategyFor(unit)
    if (!this.strategies.BY_DESCENDING_ORDER.includes(strategy)) return []
    if (strategy === this.strategy) return []
    if (this.strategyIndex(strategy) <= this.strategyIndex(this.strategy)) {
      return []
    }
    return this.notesInPeriodFor(strategy)
  }

  private notesInPeriodFor(strategy: JournalNoteStrategy): JournalNote[] {
    const notes: JournalNote[] = []
    const m = this.fileMoment.clone()
    while (this.name === m.format(this.strategy.filePattern)) {
      notes.push(this.createNote(strategy, m))
      m.add(1, strategy.timeUnit)
    }
    return notes
  }

  private strategyIndex(strategy: JournalNoteStrategy): number {
    return this.strategies.BY_DESCENDING_ORDER.indexOf(strategy)
  }

  getFolderName(): string | undefined {
    return this.folderName
  }

  shortLinkFrom(note: JournalNote, needsConfirmation = false): Link {
    const pattern =
      note.formattedYear() === this.formattedYear(note.strategy.yearPattern)
        ? this.strategy.shortTitlePattern
        : this.strategy.mediumTitlePattern
    return this.linkWithTitlePattern(pattern, needsConfirmation)
  }

  link(
    titlePattern: 'regular' | 'short' = 'short',
    needsConfirmation = false
  ): Link {
    const pattern =
      titlePattern === 'regular'
        ? this.strategy.titlePattern
        : this.strategy.shortTitlePattern
    return this.linkWithTitlePattern(pattern, needsConfirmation)
  }

  linkWithTitlePattern(pattern: string, needsConfirmation = false): Link {
    return this.createJournalNoteLink(
      pattern,
      this.strategy.filePattern,
      this.fileMoment,
      needsConfirmation
    )
  }

  closestSibling(beforeOrAfter: 'before' | 'after'): JournalNote | undefined {
    const multiplier = beforeOrAfter === 'before' ? -1 : 1
    const adjacentFileName = this.siblings.getNames().reduce<string | null>(
      (prev, curr) => {
        if (!this.strategy.fileRegex.test(curr)) return prev
        if (curr.localeCompare(this.name) * multiplier <= 0) return prev
        if (prev == null) return curr
        return curr.localeCompare(prev) * multiplier < 0 ? curr : prev
      },
      null
    )

    if (adjacentFileName) {
      return this.createNoteOfSameTimeUnit(
        // @ts-ignore
        moment(adjacentFileName, this.strategy.filePattern)
      )
    }
  }

  private formattedYear(yearPattern = this.strategy.yearPattern): string {
    return this.fileMoment.format(yearPattern)
  }

  private getLowerOrderStrategy(): JournalNoteStrategy | undefined {
    let currentStrategyFound = false

    for (const strategy of this.strategies.BY_DESCENDING_ORDER) {
      if (currentStrategyFound) {
        // Yearly notes should keep months as their primary lower-order
        // list when quarters are enabled — quarters get their own
        // dedicated section in the More panel rather than replacing the
        // 12-month list.
        if (
          this.strategy === this.strategies.YEARLY_NOTE_STRATEGY &&
          strategy === this.strategies.QUARTERLY_NOTE_STRATEGY
        ) {
          continue
        }
        return strategy
      }
      currentStrategyFound = this.strategy === strategy
    }
  }

  private createJournalNoteLink(
    titlePattern: string,
    fileNamePattern: string,
    targetMoment: moment.Moment = this.fileMoment,
    needsConfirmation = false
  ): Link {
    return {
      title: targetMoment.format(titlePattern),
      url: this.fullPath(targetMoment.format(fileNamePattern)),
      needsConfirmation,
    }
  }

  private createNoteOfSameTimeUnit(moment: moment.Moment): JournalNote {
    return new JournalNote(
      this.strategies,
      this.folderName,
      this.path,
      this.siblings,
      this.strategy,
      moment,
      this.present,
      this.today
    )
  }

  private createNote(
    strategy: JournalNoteStrategy,
    moment: moment.Moment = this.fileMoment
  ): JournalNote {
    return new JournalNote(
      this.strategies,
      this.folderName,
      this.path,
      this.siblings,
      strategy,
      startOfInterval(moment, strategy.filePattern),
      startOfInterval(this.today, strategy.filePattern),
      this.today
    )
  }

  private fullPath(fileName: string): string {
    return normalizePath(this.path ? `${this.path}/${fileName}` : fileName)
  }
}
