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

import { moment } from 'obsidian'
import type { JournalNote } from '../../data-access'

export type CalendarCell = {
  label: string
  url: string
  exists: boolean
  isCurrent: boolean
  isToday: boolean
  isPast: boolean
  needsConfirmation: boolean
  isOutsideMonth: boolean
}

export type CalendarWeek = {
  weekCell: CalendarCell
  days: CalendarCell[]
}

export type CalendarMonth = {
  monthIso: string
  monthCell: CalendarCell
  yearCell: CalendarCell
  weekdayHeaders: string[]
  weeks: CalendarWeek[]
}

export type CalendarInfo = {
  months: CalendarMonth[]
}

export type CalendarOptions = {
  visibleMonthCount: number
  offsetMonths?: number
}

const ROWS_PER_MONTH = 6
const DAYS_PER_WEEK = 7

export function monthsBeforeAnchor(visibleMonthCount: number): number {
  return Math.floor(Math.max(1, visibleMonthCount) / 2)
}

export function buildCalendarInfo(
  note: JournalNote,
  options: CalendarOptions
): CalendarInfo {
  const visibleCount = Math.max(1, Math.floor(options.visibleMonthCount))
  const offset = options.offsetMonths ?? 0
  const before = monthsBeforeAnchor(visibleCount)

  const anchor = note.getMoment().startOf('month')
  // @ts-ignore — first visible month relative to current note's month.
  const firstMonth: moment.Moment = anchor
    .clone()
    .subtract(before, 'month')
    .add(offset, 'month')

  const months: CalendarMonth[] = []
  for (let i = 0; i < visibleCount; i++) {
    months.push(buildMonth(note, firstMonth.clone().add(i, 'month')))
  }
  return { months }
}

function buildMonth(note: JournalNote, monthMoment: moment.Moment): CalendarMonth {
  const monthStart = monthMoment.clone().startOf('month')
  const gridStart = monthStart.clone().startOf('week')

  const weekdayHeaders = buildWeekdayHeaders(gridStart)
  const weeks: CalendarWeek[] = []

  for (let row = 0; row < ROWS_PER_MONTH; row++) {
    const days: CalendarCell[] = []
    for (let col = 0; col < DAYS_PER_WEEK; col++) {
      const day = gridStart.clone().add(row * DAYS_PER_WEEK + col, 'day')
      days.push(buildDayCell(note, day, monthStart))
    }
    const rowStart = gridStart.clone().add(row * DAYS_PER_WEEK, 'day')
    weeks.push({ weekCell: buildWeekCell(note, rowStart), days })
  }

  return {
    monthIso: monthStart.format('YYYY-MM'),
    monthCell: buildMonthCell(note, monthStart),
    yearCell: buildYearCell(note, monthStart),
    weekdayHeaders,
    weeks,
  }
}

function buildWeekdayHeaders(gridStart: moment.Moment): string[] {
  const headers: string[] = []
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    headers.push(gridStart.clone().add(i, 'day').format('dd'))
  }
  return headers
}

function buildDayCell(
  note: JournalNote,
  day: moment.Moment,
  monthStart: moment.Moment
): CalendarCell {
  const dayNote = note.noteFor('day', day)
  const exists = dayNote.isExistingNote()
  const isPast = dayNote.isPast()
  return {
    label: day.format('D'),
    url: dayNote.linkWithTitlePattern('YYYY-MM-DD').url,
    exists,
    isCurrent: isCurrentForUnit(note, 'day', day),
    isToday: dayNote.isToday(),
    isPast,
    needsConfirmation: isPast && !exists,
    isOutsideMonth: !day.isSame(monthStart, 'month'),
  }
}

function buildWeekCell(note: JournalNote, rowStart: moment.Moment): CalendarCell {
  const weekNote = note.noteFor('week', rowStart)
  const exists = weekNote.isExistingNote()
  const isPast = weekNote.isPast()
  return {
    label: rowStart.format('w'),
    url: weekNote.linkWithTitlePattern('gggg-[W]ww').url,
    exists,
    isCurrent: isCurrentForUnit(note, 'week', rowStart),
    isToday: false,
    isPast,
    needsConfirmation: isPast && !exists,
    isOutsideMonth: false,
  }
}

function buildMonthCell(note: JournalNote, monthStart: moment.Moment): CalendarCell {
  const monthNote = note.noteFor('month', monthStart)
  const exists = monthNote.isExistingNote()
  const isPast = monthNote.isPast()
  return {
    label: monthStart.format('MMM'),
    url: monthNote.linkWithTitlePattern('YYYY-MM').url,
    exists,
    isCurrent: isCurrentForUnit(note, 'month', monthStart),
    isToday: false,
    isPast,
    needsConfirmation: isPast && !exists,
    isOutsideMonth: false,
  }
}

function buildYearCell(note: JournalNote, monthStart: moment.Moment): CalendarCell {
  const yearNote = note.noteFor('year', monthStart)
  const exists = yearNote.isExistingNote()
  const isPast = yearNote.isPast()
  return {
    label: monthStart.format('YYYY'),
    url: yearNote.linkWithTitlePattern('YYYY').url,
    exists,
    isCurrent: isCurrentForUnit(note, 'year', monthStart),
    isToday: false,
    isPast,
    needsConfirmation: isPast && !exists,
    isOutsideMonth: false,
  }
}

function isCurrentForUnit(
  note: JournalNote,
  unit: 'day' | 'week' | 'month' | 'year',
  m: moment.Moment
): boolean {
  if (note.getTimeUnit() !== unit) return false
  return m.isSame(note.getMoment(), unit)
}
