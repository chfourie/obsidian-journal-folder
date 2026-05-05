import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCalendarInfo,
  monthsBeforeAnchor,
} from '../../src/features/journal-header/journal-calendar-info'
import { journalNoteFactoryWithSettings } from '../../src/data-access/journal-note'
import { DEFAULT_SETTINGS } from '../../src/data-access/journal-folder-settings.type'
import { buildApp } from '../helpers/fixtures'

// Sunday in May 2026 (US locale week 19, weeks start Sunday).
const TODAY = new Date('2026-05-03T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('monthsBeforeAnchor', () => {
  // Default position: as close to centre as possible, biased right when even.
  it.each([
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
  ])('with %i visible months, anchor sits with %i months before', (n, before) => {
    expect(monthsBeforeAnchor(n)).toBe(before)
  })
})

describe('buildCalendarInfo - layout', () => {
  it('produces N months when visibleMonthCount = N', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 5 })
    expect(info.months).toHaveLength(5)
  })

  it('places the current note month at the right-biased centre by default', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    // 5 visible → before = floor(5/2) = 2 → current sits at index 2 (0-based).
    const info = buildCalendarInfo(note, { visibleMonthCount: 5 })
    expect(info.months.map((m) => m.monthIso)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ])
  })

  it('right-biases when an even number of months is shown', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    // 4 visible → before = 2 → current at index 2 (third), one month after.
    const info = buildCalendarInfo(note, { visibleMonthCount: 4 })
    expect(info.months.map((m) => m.monthIso)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ])
  })

  it('puts the current month last when only one month is visible', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    expect(info.months.map((m) => m.monthIso)).toEqual(['2026-05'])
  })

  it('shifts the visible window by offsetMonths', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, {
      visibleMonthCount: 3,
      offsetMonths: -2,
    })
    // Default placed 2026-05 at index 1 (3→before=1). Offset -2 → window shifts left by 2.
    expect(info.months.map((m) => m.monthIso)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
    ])
  })
})

describe('buildCalendarInfo - month structure', () => {
  it('emits 6 rows of 7 days per month', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    expect(may.weeks).toHaveLength(6)
    for (const week of may.weeks) {
      expect(week.days).toHaveLength(7)
    }
  })

  it('starts the week on the locale first day (Sunday in en) and labels weekdays', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    expect(may.weekdayHeaders.map((h) => h.label)).toEqual([
      'Su',
      'Mo',
      'Tu',
      'We',
      'Th',
      'Fr',
      'Sa',
    ])
  })

  it('flags only the Sunday weekday header as isSunday', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    // Locale first day is Sunday in en, so the Sunday header is at index 0.
    expect(may.weekdayHeaders.map((h) => h.isSunday)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it('marks Sunday day cells with isSunday across the whole month', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    // May 2026 Sundays: 3, 10, 17, 24, 31. Filter to in-month cells only.
    const sundays = may.weeks
      .flatMap((w) => w.days)
      .filter((d) => !d.isOutsideMonth && d.isSunday)
      .map((d) => d.label)
    expect(sundays).toEqual(['3', '10', '17', '24', '31'])
  })

  it('does not set isSunday on week, month, or year cells', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    expect(may.monthCell.isSunday).toBe(false)
    expect(may.yearCell.isSunday).toBe(false)
    expect(may.weeks.every((w) => w.weekCell.isSunday === false)).toBe(true)
  })

  it('marks days outside the displayed month as isOutsideMonth', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    // 2026-05-01 is a Friday → first row pads Sun..Thu (5 cells) with April.
    const firstRow = may.weeks[0].days
    expect(firstRow.slice(0, 5).every((d) => d.isOutsideMonth)).toBe(true)
    expect(firstRow.slice(5).every((d) => d.isOutsideMonth)).toBe(false)
  })
})

describe('buildCalendarInfo - cell metadata', () => {
  it('flags the current note day as isCurrent (daily note)', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const allDays = info.months[0].weeks.flatMap((w) => w.days)
    const current = allDays.filter((d) => d.isCurrent)
    expect(current).toHaveLength(1)
    expect(current[0].label).toBe('3')
    expect(current[0].url).toBe('Journal/2026-05-03')
  })

  it('flags today on the day cell regardless of which day the note is', () => {
    const { files } = buildApp('Journal', ['2026-05-01'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-01']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const todays = info.months[0].weeks
      .flatMap((w) => w.days)
      .filter((d) => d.isToday && !d.isOutsideMonth)
    expect(todays.map((d) => d.label)).toEqual(['3'])
  })

  it('does not flag any day cell isCurrent when the note is monthly, but flags the month cell', () => {
    const { files } = buildApp('Journal', ['2026-05'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    expect(may.monthCell.isCurrent).toBe(true)
    expect(may.yearCell.isCurrent).toBe(false)
    const anyDayIsCurrent = may.weeks
      .flatMap((w) => w.days)
      .some((d) => d.isCurrent)
    expect(anyDayIsCurrent).toBe(false)
  })

  it('flags the current week cell when the note is weekly', () => {
    const { files } = buildApp('Journal', ['2026-W19'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-W19']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    const currentWeek = may.weeks.filter((w) => w.weekCell.isCurrent)
    expect(currentWeek).toHaveLength(1)
    expect(currentWeek[0].weekCell.label).toBe('19')
  })

  it('flags the year cell as current when the note is yearly', () => {
    const { files } = buildApp('Journal', ['2026'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(files['2026'])
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    expect(info.months[0].yearCell.isCurrent).toBe(true)
    expect(info.months[0].monthCell.isCurrent).toBe(false)
  })

  it('marks past missing day cells as needsConfirmation (and isPast)', () => {
    // Today is 2026-05-03; folder only has 2026-05-03, so 2026-05-01 is past+missing.
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may1 = info.months[0].weeks
      .flatMap((w) => w.days)
      .find((d) => d.label === '1' && !d.isOutsideMonth)!
    expect(may1.exists).toBe(false)
    expect(may1.isPast).toBe(true)
    expect(may1.needsConfirmation).toBe(true)
  })

  it('does not require confirmation for future missing days', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may10 = info.months[0].weeks
      .flatMap((w) => w.days)
      .find((d) => d.label === '10' && !d.isOutsideMonth)!
    expect(may10.exists).toBe(false)
    expect(may10.isPast).toBe(false)
    expect(may10.needsConfirmation).toBe(false)
  })

  it('reports exists for cells whose notes are present in the folder', () => {
    const { files } = buildApp('Journal', [
      '2026-05-03',
      '2026-05-01',
      '2026-W18',
      '2026-05',
    ])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    expect(may.monthCell.exists).toBe(true)
    expect(may.yearCell.exists).toBe(false)
    const may1 = may.weeks
      .flatMap((w) => w.days)
      .find((d) => d.label === '1' && !d.isOutsideMonth)!
    expect(may1.exists).toBe(true)
    const w18 = may.weeks.find((w) => w.weekCell.label === '18')!
    expect(w18.weekCell.exists).toBe(true)
    const w20 = may.weeks.find((w) => w.weekCell.label === '20')!
    expect(w20.weekCell.exists).toBe(false)
  })

  it('uses the locale weekly note pattern (gggg-[W]ww) for week URLs', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const week = info.months[0].weeks.find((w) => w.weekCell.label === '19')!
    expect(week.weekCell.url).toBe('Journal/2026-W19')
  })

  it('builds month and year cells with the correct URLs', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )
    const info = buildCalendarInfo(note, { visibleMonthCount: 1 })
    const may = info.months[0]
    expect(may.monthCell.url).toBe('Journal/2026-05')
    expect(may.yearCell.url).toBe('Journal/2026')
  })
})
