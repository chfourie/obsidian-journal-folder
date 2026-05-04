import { describe, expect, it } from 'vitest'
import {
  ARROW_PX,
  DESKTOP_MIN_MONTH_PX,
  MAX_MONTHS,
  MOBILE_MIN_MONTH_PX,
  pickVisibleMonthCount,
} from '../../src/features/journal-header/visible-month-count'

const desktop = { isMobile: false }
const mobile = { isMobile: true }

describe('pickVisibleMonthCount', () => {
  it('returns 1 when the container has not been measured yet', () => {
    expect(pickVisibleMonthCount(0, desktop)).toBe(1)
    expect(pickVisibleMonthCount(-50, desktop)).toBe(1)
  })

  it('floors at 1 even when no full month width fits', () => {
    expect(pickVisibleMonthCount(ARROW_PX * 2 + 50, desktop)).toBe(1)
    expect(pickVisibleMonthCount(ARROW_PX * 2 + 50, mobile)).toBe(1)
  })

  it('caps at MAX_MONTHS even when the container is huge', () => {
    expect(pickVisibleMonthCount(10_000, desktop)).toBe(MAX_MONTHS)
    expect(pickVisibleMonthCount(10_000, mobile)).toBe(MAX_MONTHS)
  })

  it('uses 180px per month on desktop', () => {
    // Three months fit when the available width is >= 540px.
    const justEnough = ARROW_PX * 2 + DESKTOP_MIN_MONTH_PX * 3
    expect(pickVisibleMonthCount(justEnough, desktop)).toBe(3)
    expect(pickVisibleMonthCount(justEnough - 1, desktop)).toBe(2)
  })

  it('uses 280px per month on mobile so cells have room for tap targets', () => {
    const justEnough = ARROW_PX * 2 + MOBILE_MIN_MONTH_PX * 2
    expect(pickVisibleMonthCount(justEnough, mobile)).toBe(2)
    expect(pickVisibleMonthCount(justEnough - 1, mobile)).toBe(1)
  })

  it('packs more months on desktop than mobile for the same container width', () => {
    const width = 720
    expect(pickVisibleMonthCount(width, desktop)).toBeGreaterThan(
      pickVisibleMonthCount(width, mobile)
    )
  })
})
