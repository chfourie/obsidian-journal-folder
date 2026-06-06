import { describe, expect, it } from 'vitest'
import { moment } from '../../mocks/obsidian'
import {
  makeRangeCapFilter,
  rangeCapsByCategory,
  smallestTaskCap,
} from '../../../src/features/journal-tasks/task-range-cap'
import type { ReferenceRange } from '../../../src/features/journal-tasks/reference-range'
import type { TaskCategory } from '../../../src/data-access'

const cat = (id: string, maxRange?: TaskCategory['maxRange']): TaskCategory => ({
  id,
  label: id,
  tags: [id],
  maxRange,
})

// A single-day reference range for the given ISO date.
const day = (iso: string): ReferenceRange => ({
  start: moment(iso).startOf('day'),
  end: moment(iso).endOf('day'),
})

describe('rangeCapsByCategory', () => {
  it('keeps only categories that declare a cap', () => {
    const caps = rangeCapsByCategory([
      cat('a', 'day'),
      cat('b'),
      cat('c', 'month'),
    ])
    expect([...caps.entries()]).toEqual([
      ['a', 'day'],
      ['c', 'month'],
    ])
  })
})

describe('smallestTaskCap', () => {
  const caps = rangeCapsByCategory([
    cat('day', 'day'),
    cat('week', 'week'),
    cat('month', 'month'),
    cat('none'),
  ])

  it('returns null when the task is in no capped category', () => {
    expect(smallestTaskCap({ categoryIds: ['none'] }, caps)).toBeNull()
    expect(smallestTaskCap({ categoryIds: [] }, caps)).toBeNull()
  })

  it('returns the only cap when a single capped category matches', () => {
    expect(smallestTaskCap({ categoryIds: ['week'] }, caps)).toBe('week')
  })

  it('returns the smallest cap when several capped categories match', () => {
    expect(
      smallestTaskCap({ categoryIds: ['month', 'day', 'week'] }, caps)
    ).toBe('day')
  })

  it('ignores capped categories the task does not belong to', () => {
    expect(smallestTaskCap({ categoryIds: ['month', 'none'] }, caps)).toBe(
      'month'
    )
  })
})

describe('makeRangeCapFilter', () => {
  // Mid-June 2026; the 15th is a Monday so week math is unambiguous.
  const base = moment('2026-06-15')
  const categories = [cat('local', 'day'), cat('weekish', 'week'), cat('plain')]

  it('passes tasks with no capped category through untouched', () => {
    const filter = makeRangeCapFilter({ base, listUnit: 'all', categories })
    expect(filter({ categoryIds: ['plain'] }, day('1999-01-01'))).toBe(true)
  })

  it('does not constrain when the cap is not smaller than the list range', () => {
    // list range is day; a week cap is larger, so it can't bite.
    const filter = makeRangeCapFilter({ base, listUnit: 'day', categories })
    expect(filter({ categoryIds: ['weekish'] }, day('2026-06-25'))).toBe(true)
  })

  it('constrains to the capped period when the cap is smaller (incl. `all`)', () => {
    const filter = makeRangeCapFilter({ base, listUnit: 'all', categories })
    // day-capped: only the anchor day passes.
    expect(filter({ categoryIds: ['local'] }, day('2026-06-15'))).toBe(true)
    expect(filter({ categoryIds: ['local'] }, day('2026-06-16'))).toBe(false)
  })

  it('uses the anchor base for the capped window', () => {
    const filter = makeRangeCapFilter({ base, listUnit: 'month', categories })
    // week cap: same calendar week as the 15th passes, later week fails.
    expect(filter({ categoryIds: ['weekish'] }, day('2026-06-16'))).toBe(true)
    expect(filter({ categoryIds: ['weekish'] }, day('2026-06-25'))).toBe(false)
  })

  it('applies the smallest cap when a task is in several capped categories', () => {
    const filter = makeRangeCapFilter({ base, listUnit: 'all', categories })
    // local (day) + weekish (week) → day wins, so only the anchor day passes.
    expect(
      filter({ categoryIds: ['weekish', 'local'] }, day('2026-06-16'))
    ).toBe(false)
    expect(
      filter({ categoryIds: ['weekish', 'local'] }, day('2026-06-15'))
    ).toBe(true)
  })

  describe('note floor (floorUnit)', () => {
    const cats = [cat('local', 'day')]

    it('floors a finer cap up to the note tier, so it stops biting', () => {
      // Note-anchored on a month: the day-cap is floored to month, and the
      // effective list range is also month → no bite, task passes regardless.
      const filter = makeRangeCapFilter({
        base,
        listUnit: 'month',
        categories: cats,
        floorUnit: 'month',
      })
      expect(filter({ categoryIds: ['local'] }, day('2026-06-25'))).toBe(true)
    })

    it('still bites at the floored grain when the list range is larger', () => {
      // Monthly note, list range year: day-cap floored to month → window is the
      // note's month, so June passes but March does not.
      const filter = makeRangeCapFilter({
        base,
        listUnit: 'year',
        categories: cats,
        floorUnit: 'month',
      })
      expect(filter({ categoryIds: ['local'] }, day('2026-06-25'))).toBe(true)
      expect(filter({ categoryIds: ['local'] }, day('2026-03-25'))).toBe(false)
    })

    it('does not floor when floorUnit is null (Today anchor)', () => {
      const filter = makeRangeCapFilter({
        base,
        listUnit: 'month',
        categories: cats,
        floorUnit: null,
      })
      // Day-cap is unaffected → window is the single anchor day.
      expect(filter({ categoryIds: ['local'] }, day('2026-06-15'))).toBe(true)
      expect(filter({ categoryIds: ['local'] }, day('2026-06-25'))).toBe(false)
    })
  })
})
