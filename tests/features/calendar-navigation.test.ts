import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { moment } from 'obsidian'
import {
  anchorMonth,
  monthOptions,
  offsetForTarget,
} from '../../src/features/journal-header/calendar-navigation'

const TODAY = new Date('2026-05-03T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('anchorMonth', () => {
  it('returns the note month when offset is 0', () => {
    // @ts-ignore
    const noteMoment = moment('2026-05-03', 'YYYY-MM-DD')
    expect(anchorMonth(noteMoment, 0)).toEqual({ year: 2026, month: 4 })
  })

  it('shifts forward by positive offset', () => {
    // @ts-ignore
    const noteMoment = moment('2026-05-03', 'YYYY-MM-DD')
    expect(anchorMonth(noteMoment, 3)).toEqual({ year: 2026, month: 7 })
  })

  it('shifts backward by negative offset', () => {
    // @ts-ignore
    const noteMoment = moment('2026-05-03', 'YYYY-MM-DD')
    expect(anchorMonth(noteMoment, -6)).toEqual({ year: 2025, month: 10 })
  })

  it('crosses year boundaries cleanly when offsetting forward', () => {
    // @ts-ignore
    const noteMoment = moment('2026-05-03', 'YYYY-MM-DD')
    expect(anchorMonth(noteMoment, 14)).toEqual({ year: 2027, month: 6 })
  })

  it('does not depend on the day-of-month component of the note', () => {
    // @ts-ignore
    const a = moment('2026-05-01', 'YYYY-MM-DD')
    // @ts-ignore
    const b = moment('2026-05-31', 'YYYY-MM-DD')
    expect(anchorMonth(a, 2)).toEqual(anchorMonth(b, 2))
  })
})

describe('offsetForTarget', () => {
  it('returns 0 when the target equals the note month', () => {
    // @ts-ignore
    const noteMoment = moment('2026-05-03', 'YYYY-MM-DD')
    expect(offsetForTarget(noteMoment, 2026, 4)).toBe(0)
  })

  it('returns the months between the note and a future target', () => {
    // @ts-ignore
    const noteMoment = moment('2026-05-03', 'YYYY-MM-DD')
    // May 2026 → Feb 2027 = +9 months.
    expect(offsetForTarget(noteMoment, 2027, 1)).toBe(9)
  })

  it('returns a negative value for a past target', () => {
    // @ts-ignore
    const noteMoment = moment('2026-05-03', 'YYYY-MM-DD')
    // May 2026 → Nov 2025 = -6 months.
    expect(offsetForTarget(noteMoment, 2025, 10)).toBe(-6)
  })

  it('round-trips with anchorMonth', () => {
    // @ts-ignore
    const noteMoment = moment('2026-05-03', 'YYYY-MM-DD')
    for (const target of [
      { year: 2026, month: 4 },
      { year: 2024, month: 0 },
      { year: 2030, month: 11 },
    ]) {
      const offset = offsetForTarget(noteMoment, target.year, target.month)
      expect(anchorMonth(noteMoment, offset)).toEqual(target)
    }
  })
})

describe('monthOptions', () => {
  it('produces 12 entries with sequential 0..11 values', () => {
    const opts = monthOptions()
    expect(opts).toHaveLength(12)
    expect(opts.map((o) => o.value)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ])
  })

  it('uses moment short labels in the active locale (Jan..Dec for en)', () => {
    const opts = monthOptions()
    expect(opts.map((o) => o.label)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ])
  })
})

