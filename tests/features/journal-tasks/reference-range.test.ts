import { describe, expect, it } from 'vitest'
import { moment, TFile, TFolder } from '../../mocks/obsidian'
import {
  DEFAULT_SETTINGS,
  journalNoteFactoryWithSettings,
} from '../../../src/data-access'
import {
  allTimeRange,
  buildReferenceRange,
  currentPeriodRange,
  largerRangeUnit,
  periodAround,
  rangeForNote,
  rangesIntersect,
  todayRange,
} from '../../../src/features/journal-tasks/reference-range'

function makeNote(basename: string) {
  const folder = new TFolder()
  folder.path = 'Journal'
  folder.name = 'Journal'
  folder.children = []
  const file = new TFile()
  file.basename = basename
  file.name = `${basename}.md`
  file.path = `Journal/${basename}.md`
  file.parent = folder
  folder.children.push(file)
  return journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(file)
}

describe('buildReferenceRange', () => {
  it('sidebar + anchor today + range day → today range', () => {
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'today',
      range: 'day',
    })
    const today = moment().startOf('day')
    expect(range.start.isSame(today, 'day')).toBe(true)
    expect(range.end.isSame(today, 'day')).toBe(true)
  })

  it('sidebar + anchor note + range day with journal note → note day', () => {
    const note = makeNote('2026-06-03')
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'note',
      range: 'day',
      activeNote: note,
    })
    expect(range.start.format('YYYY-MM-DD')).toBe('2026-06-03')
    expect(range.end.format('YYYY-MM-DD')).toBe('2026-06-03')
  })

  it('sidebar + anchor note + range month with a daily note → its month', () => {
    const note = makeNote('2026-06-03')
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'note',
      range: 'month',
      activeNote: note,
    })
    expect(range.start.format('YYYY-MM-DD')).toBe('2026-06-01')
    expect(range.end.format('YYYY-MM-DD')).toBe('2026-06-30')
  })

  it('sidebar + anchor note + range day with a MONTHLY note → its whole month (floored up)', () => {
    const note = makeNote('2026-06')
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'note',
      range: 'day',
      activeNote: note,
    })
    expect(range.start.format('YYYY-MM-DD')).toBe('2026-06-01')
    expect(range.end.format('YYYY-MM-DD')).toBe('2026-06-30')
  })

  it('sidebar + anchor note + range week with a MONTHLY note → its whole month (week < month)', () => {
    const note = makeNote('2026-06')
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'note',
      range: 'week',
      activeNote: note,
    })
    expect(range.start.format('YYYY-MM-DD')).toBe('2026-06-01')
    expect(range.end.format('YYYY-MM-DD')).toBe('2026-06-30')
  })

  it('sidebar + anchor note + range day with a WEEKLY note → its whole week (floored up)', () => {
    const note = makeNote('2026-W23')
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'note',
      range: 'day',
      activeNote: note,
    })
    expect(range.end.diff(range.start, 'days')).toBe(6)
  })

  it('sidebar + anchor note + range year with a monthly note → the containing year (range > note tier)', () => {
    const note = makeNote('2026-06')
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'note',
      range: 'year',
      activeNote: note,
    })
    expect(range.start.format('YYYY-MM-DD')).toBe('2026-01-01')
    expect(range.end.format('YYYY-MM-DD')).toBe('2026-12-31')
  })

  it('sidebar + anchor TODAY is NOT floored by an active monthly note', () => {
    const note = makeNote('2026-06')
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'today',
      range: 'day',
      activeNote: note,
    })
    const today = moment().startOf('day')
    expect(range.start.isSame(today, 'day')).toBe(true)
    expect(range.end.isSame(today, 'day')).toBe(true)
  })

  it('sidebar + anchor note with no active note → falls back to today', () => {
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'note',
      range: 'day',
      activeNote: null,
    })
    expect(range.start.isSame(todayRange().start, 'day')).toBe(true)
  })

  it('sidebar + anchor today + range week → current week', () => {
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'today',
      range: 'week',
    })
    expect(range.start.isSame(moment().startOf('week'), 'day')).toBe(true)
    expect(range.end.isSame(moment().endOf('week'), 'day')).toBe(true)
  })

  it('sidebar + anchor today + range quarter → current quarter', () => {
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'today',
      range: 'quarter',
    })
    expect(range.start.isSame(moment().startOf('quarter'), 'day')).toBe(true)
    expect(range.end.isSame(moment().endOf('quarter'), 'day')).toBe(true)
  })

  it('sidebar + anchor today + range year → current year', () => {
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'today',
      range: 'year',
    })
    expect(range.start.isSame(moment().startOf('year'), 'day')).toBe(true)
    expect(range.end.isSame(moment().endOf('year'), 'day')).toBe(true)
  })

  it('sidebar + range all → an unbounded range that intersects any note', () => {
    const range = buildReferenceRange({
      host: 'sidebar',
      anchor: 'today',
      range: 'all',
    })
    const note = makeNote('1999-01-01')
    expect(rangesIntersect(rangeForNote(note), range)).toBe(true)
    expect(range.start.year()).toBeLessThan(1000)
    expect(range.end.year()).toBeGreaterThan(9000)
  })

  it('note host with journal active note → note own range (ignores axes)', () => {
    const note = makeNote('2026-06')
    const range = buildReferenceRange({ host: 'note', activeNote: note })
    expect(range.start.format('YYYY-MM-DD')).toBe('2026-06-01')
    expect(range.end.format('YYYY-MM-DD')).toBe('2026-06-30')
  })

  it('note host without active note → today range', () => {
    const range = buildReferenceRange({ host: 'note', activeNote: null })
    expect(range.start.isSame(todayRange().start, 'day')).toBe(true)
  })
})

describe('periodAround / currentPeriodRange', () => {
  it('periodAround spans the month containing the base', () => {
    const range = periodAround(moment('2026-02-15'), 'month')
    expect(range.start.format('YYYY-MM-DD')).toBe('2026-02-01')
    expect(range.end.format('YYYY-MM-DD')).toBe('2026-02-28')
  })

  it('currentPeriodRange spans the whole current month', () => {
    const range = currentPeriodRange('month')
    expect(range.start.isSame(moment().startOf('month'))).toBe(true)
    expect(range.end.isSame(moment().endOf('month'))).toBe(true)
  })

  it('allTimeRange is extremely wide', () => {
    const range = allTimeRange()
    expect(range.start.year()).toBeLessThan(1000)
    expect(range.end.year()).toBeGreaterThan(9000)
  })
})

describe('largerRangeUnit', () => {
  it('returns the coarser unit', () => {
    expect(largerRangeUnit('day', 'month')).toBe('month')
    expect(largerRangeUnit('year', 'week')).toBe('year')
    expect(largerRangeUnit('quarter', 'quarter')).toBe('quarter')
    expect(largerRangeUnit('week', 'all')).toBe('all')
  })
})

describe('rangeForNote', () => {
  it('returns inclusive [start, end] for a weekly note', () => {
    const note = makeNote('2026-W23')
    const range = rangeForNote(note)
    expect(range.end.diff(range.start, 'days')).toBe(6)
  })
})

describe('rangesIntersect', () => {
  const day = (s: string) => ({
    start: moment(s).startOf('day'),
    end: moment(s).endOf('day'),
  })
  it('returns true when ranges overlap', () => {
    expect(
      rangesIntersect(
        { start: moment('2026-06-01'), end: moment('2026-06-10') },
        { start: moment('2026-06-05'), end: moment('2026-06-15') }
      )
    ).toBe(true)
  })
  it('returns false when fully before', () => {
    expect(rangesIntersect(day('2026-06-01'), day('2026-06-02'))).toBe(false)
  })
  it('returns true on a single shared day boundary', () => {
    expect(
      rangesIntersect(
        { start: moment('2026-06-01'), end: moment('2026-06-03').endOf('day') },
        { start: moment('2026-06-03'), end: moment('2026-06-05').endOf('day') }
      )
    ).toBe(true)
  })
})
