import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { moment } from 'obsidian'
import {
  _resetLocaleDefaultCache,
  applyStartOfWeek,
  resolveWeekConfig,
} from '../../src/data-access/apply-start-of-week'

const ORIGINAL_LOCALE = moment.locale()

function currentWeekConfig(): { dow: number; doy: number } {
  // @ts-ignore — exposed by moment's localeData()
  const data = moment.localeData()
  return { dow: data.firstDayOfWeek(), doy: data.firstDayOfYear() }
}

describe('applyStartOfWeek', () => {
  let originalConfig: { dow: number; doy: number }

  beforeEach(() => {
    moment.locale(ORIGINAL_LOCALE)
    _resetLocaleDefaultCache()
    originalConfig = currentWeekConfig()
  })

  afterEach(() => {
    // Restore the locale's natural week config so other tests don't inherit
    // an overridden moment locale.
    // @ts-ignore — moment.updateLocale accepts a `week` config block.
    moment.updateLocale(moment.locale(), { week: { ...originalConfig } })
  })

  it('locale-default leaves moment locale untouched', () => {
    applyStartOfWeek('locale-default')
    expect(currentWeekConfig()).toEqual(originalConfig)
  })

  it('explicit weekday names update dow and put Jan 1 in week 1', () => {
    applyStartOfWeek('monday')
    expect(currentWeekConfig()).toEqual({ dow: 1, doy: 7 })

    applyStartOfWeek('sunday')
    expect(currentWeekConfig()).toEqual({ dow: 0, doy: 6 })

    applyStartOfWeek('saturday')
    expect(currentWeekConfig()).toEqual({ dow: 6, doy: 12 })
  })

  it('switching back to locale-default restores the original config', () => {
    applyStartOfWeek('thursday')
    expect(currentWeekConfig().dow).toBe(4)

    applyStartOfWeek('locale-default')
    expect(currentWeekConfig()).toEqual(originalConfig)
  })

  it('unknown values fall back to the locale default', () => {
    applyStartOfWeek('not-a-day' as never)
    expect(currentWeekConfig()).toEqual(originalConfig)
  })

  it('startOf(week) and weekday header reflect the override', () => {
    applyStartOfWeek('monday')
    // 2026-01-15 is a Thursday — startOf('week') should resolve to Mon Jan 12.
    // @ts-ignore
    const weekStart = moment('2026-01-15').startOf('week')
    expect(weekStart.format('YYYY-MM-DD')).toBe('2026-01-12')
    expect(weekStart.format('dd')).toBe('Mo')

    applyStartOfWeek('sunday')
    // @ts-ignore
    const weekStartSun = moment('2026-01-15').startOf('week')
    expect(weekStartSun.format('YYYY-MM-DD')).toBe('2026-01-11')
  })

  it('week-of-year numbering shifts with the override', () => {
    // Jan 1 2026 is a Thursday. With week 1 = "week containing Jan 1":
    //   - Monday-start: week starting Mon Dec 29 2025 → 2026-W01
    //   - Sunday-start: week starting Sun Dec 28 2025 → 2026-W01
    // The note for Mon Jan 5 2026 should be week 2 in both cases.
    applyStartOfWeek('monday')
    // @ts-ignore
    expect(moment('2026-01-05').format('gggg-[W]ww')).toBe('2026-W02')

    applyStartOfWeek('sunday')
    // @ts-ignore
    expect(moment('2026-01-04').format('gggg-[W]ww')).toBe('2026-W02')
  })
})

describe('resolveWeekConfig', () => {
  beforeEach(() => {
    _resetLocaleDefaultCache()
  })

  it('returns dow + 6 for explicit weekday names', () => {
    expect(resolveWeekConfig('monday')).toEqual({ dow: 1, doy: 7 })
    expect(resolveWeekConfig('wednesday')).toEqual({ dow: 3, doy: 9 })
  })

  it('returns the captured locale default for locale-default', () => {
    const original = currentWeekConfig()
    expect(resolveWeekConfig('locale-default')).toEqual(original)
  })
})
