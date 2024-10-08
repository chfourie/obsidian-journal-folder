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
import { moment } from 'obsidian'

type JournalNoteStrategy = {
  fileRegex: RegExp
  filePattern: string
  titlePattern: string
  shortTitlePattern: string
  mediumTitlePattern: string
  yearPattern: string
  timeUnit: 'day' | 'week' | 'month' | 'year'
}

type JournalNoteStrategies = {
  DAILY_NOTE_STRATEGY: JournalNoteStrategy
  WEEKLY_NOTE_STRATEGY: JournalNoteStrategy
  MONTHLY_NOTE_STRATEGY: JournalNoteStrategy
  YEARLY_NOTE_STRATEGY: JournalNoteStrategy
  BY_DESCENDING_ORDER: JournalNoteStrategy[]
}

export type JournalNoteFactory = (file: TFile) => JournalNote

function startOfInterval(
  sourceMoment: moment.Moment,
  pattern: string
): moment.Moment {
  // @ts-ignore
  return moment(sourceMoment.format(pattern), pattern)
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

  const YEARLY_NOTE_STRATEGY: JournalNoteStrategy = {
    fileRegex: /^[12]\d{3}$/,
    filePattern: 'YYYY',
    titlePattern: settings.yearlyNoteTitlePattern,
    shortTitlePattern: settings.yearlyNoteShortTitlePattern,
    mediumTitlePattern: settings.yearlyNoteMediumTitlePattern,
    yearPattern: 'YYYY',
    timeUnit: 'year',
  }

  const strategies: JournalNoteStrategies = {
    DAILY_NOTE_STRATEGY,
    WEEKLY_NOTE_STRATEGY,
    MONTHLY_NOTE_STRATEGY,
    YEARLY_NOTE_STRATEGY,
    BY_DESCENDING_ORDER: [
      YEARLY_NOTE_STRATEGY,
      MONTHLY_NOTE_STRATEGY,
      WEEKLY_NOTE_STRATEGY,
      DAILY_NOTE_STRATEGY,
    ],
  }

  function getNoteStrategy(file: TFile): JournalNoteStrategy {
    const buildStrategy = strategies.BY_DESCENDING_ORDER.filter((s) =>
      s.fileRegex.test(file.basename)
    ).first()

    if (!buildStrategy)
      throw new Error(
        `File name does not represent a valid journal file - ${file.basename}`
      )

    return buildStrategy
  }

  return function journalNote(file: TFile): JournalNote {
    const strategy = getNoteStrategy(file)
    // @ts-ignore
    const today = moment().startOf('day')
    const noteNames = (file.parent?.children || []).map((f) =>
      f.name.replace(/\.md$/, '')
    )

    return new JournalNote(
      strategies,
      file.parent?.name,
      file.parent?.path || '',
      noteNames,
      strategy,
      // @ts-ignore
      moment(file.basename, strategy.filePattern),
      startOfInterval(today, strategy.filePattern),
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
    private noteNames: string[],
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
    return this.noteNames.some((name) => name === this.name)
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
    const notes: JournalNote[] = []
    const lowerOrderStrategy = this.getLowerOrderStrategy()

    if (lowerOrderStrategy) {
      const moment = this.fileMoment.clone()

      while (this.name === moment.format(this.strategy.filePattern)) {
        notes.push(this.createNote(lowerOrderStrategy, moment))
        moment.add(1, lowerOrderStrategy.timeUnit)
      }
    }

    return notes
  }

  getFolderName(): string | undefined {
    return this.folderName
  }

  shortLinkFrom(note: JournalNote, inactive = false): Link {
    const pattern =
      note.formattedYear() === this.formattedYear(note.strategy.yearPattern)
        ? this.strategy.shortTitlePattern
        : this.strategy.mediumTitlePattern
    return this.linkWithTitlePattern(pattern, inactive)
  }

  link(titlePattern: 'regular' | 'short' = 'short', inactive = false): Link {
    const pattern =
      titlePattern === 'regular'
        ? this.strategy.titlePattern
        : this.strategy.shortTitlePattern
    return this.linkWithTitlePattern(pattern, inactive)
  }

  linkWithTitlePattern(pattern: string, inactive = false): Link {
    return this.createJournalNoteLink(
      pattern,
      this.strategy.filePattern,
      this.fileMoment,
      inactive
    )
  }

  closestSibling(beforeOrAfter: 'before' | 'after'): JournalNote | undefined {
    const multiplier = beforeOrAfter === 'before' ? -1 : 1
    const adjacentFileName = this.noteNames.reduce<string | null>(
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
      if (currentStrategyFound) return strategy
      currentStrategyFound = this.strategy === strategy
    }
  }

  private createJournalNoteLink(
    titlePattern: string,
    fileNamePattern: string,
    targetMoment: moment.Moment = this.fileMoment,
    inactive = false
  ): Link {
    return {
      title: targetMoment.format(titlePattern),
      url: this.fullPath(targetMoment.format(fileNamePattern)),
      inactive,
    }
  }

  private createNoteOfSameTimeUnit(moment: moment.Moment): JournalNote {
    return new JournalNote(
      this.strategies,
      this.folderName,
      this.path,
      this.noteNames,
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
      this.noteNames,
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
