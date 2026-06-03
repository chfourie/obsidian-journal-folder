import { describe, expect, it } from 'vitest'
import { moment, TFile, TFolder } from '../../mocks/obsidian'
import {
  DEFAULT_SETTINGS,
  journalNoteFactoryWithSettings,
} from '../../../src/data-access'
import {
  buildReferenceRange,
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
  it('sidebar + today → today range', () => {
    const range = buildReferenceRange({ host: 'sidebar', referenceMode: 'today' })
    const today = moment().startOf('day')
    expect(range.start.isSame(today, 'day')).toBe(true)
    expect(range.end.isSame(today, 'day')).toBe(true)
  })

  it('sidebar + dynamic with journal active note → note range', () => {
    const note = makeNote('2026-06-03')
    const range = buildReferenceRange({
      host: 'sidebar',
      referenceMode: 'dynamic',
      activeNote: note,
    })
    expect(range.start.format('YYYY-MM-DD')).toBe('2026-06-03')
    expect(range.end.format('YYYY-MM-DD')).toBe('2026-06-03')
  })

  it('sidebar + dynamic with no active note → today range', () => {
    const range = buildReferenceRange({
      host: 'sidebar',
      referenceMode: 'dynamic',
      activeNote: null,
    })
    expect(range.start.isSame(todayRange().start, 'day')).toBe(true)
  })

  it('note host with journal active note → note range', () => {
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
