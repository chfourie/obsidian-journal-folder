import { beforeEach, describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import {
  __resetCalendarVisibilityForTests,
  applyCalendarDefault,
  calendarVisible,
  toggleCalendar,
} from '../../src/features/journal-header/calendar-visibility'

beforeEach(() => {
  __resetCalendarVisibilityForTests()
})

describe('calendar visibility', () => {
  it('starts hidden', () => {
    expect(get(calendarVisible)).toBe(false)
  })

  it('applyCalendarDefault sets the visibility when the user has not toggled', () => {
    applyCalendarDefault(true)
    expect(get(calendarVisible)).toBe(true)

    applyCalendarDefault(false)
    expect(get(calendarVisible)).toBe(false)
  })

  it('toggleCalendar flips the current visibility', () => {
    toggleCalendar()
    expect(get(calendarVisible)).toBe(true)

    toggleCalendar()
    expect(get(calendarVisible)).toBe(false)
  })

  it('once the user toggles, applyCalendarDefault becomes a no-op for the rest of the session', () => {
    // User opens the calendar manually.
    toggleCalendar()
    expect(get(calendarVisible)).toBe(true)

    // Navigating to a folder whose default is `false` must not close it.
    applyCalendarDefault(false)
    expect(get(calendarVisible)).toBe(true)

    // Same for `true` after the user has explicitly closed it again.
    toggleCalendar()
    expect(get(calendarVisible)).toBe(false)
    applyCalendarDefault(true)
    expect(get(calendarVisible)).toBe(false)
  })
})
