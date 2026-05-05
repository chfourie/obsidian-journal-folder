import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../src/data-access'
import { resolveDefaultCalendarVisible } from '../../src/features/journal-header/resolve-default-calendar-visible'

function settings(
  overrides: Partial<JournalFolderSettings> = {}
): JournalFolderSettings {
  return { ...DEFAULT_SETTINGS, ...overrides }
}

describe('resolveDefaultCalendarVisible', () => {
  it('uses the desktop field when isMobile is false', () => {
    const result = resolveDefaultCalendarVisible(
      settings({
        defaultCalendarVisibleDesktop: true,
        defaultCalendarVisibleMobile: false,
      }),
      false
    )
    expect(result).toBe(true)
  })

  it('uses the mobile field when isMobile is true', () => {
    const result = resolveDefaultCalendarVisible(
      settings({
        defaultCalendarVisibleDesktop: true,
        defaultCalendarVisibleMobile: false,
      }),
      true
    )
    expect(result).toBe(false)
  })

  it('does not fall back from mobile to desktop', () => {
    // Mobile field independently false even though desktop is true.
    const result = resolveDefaultCalendarVisible(
      settings({
        defaultCalendarVisibleDesktop: true,
        defaultCalendarVisibleMobile: false,
      }),
      true
    )
    expect(result).toBe(false)
  })

  // Embedded `key: value` configs reach the resolver as raw strings; YAML
  // front-matter and the settings tab supply real booleans. The platform
  // branch must coerce both.
  it('coerces the literal string "false" to false on desktop', () => {
    const result = resolveDefaultCalendarVisible(
      settings({
        defaultCalendarVisibleDesktop: 'false' as unknown as boolean,
      }),
      false
    )
    expect(result).toBe(false)
  })

  it('coerces the literal string "false" to false on mobile', () => {
    const result = resolveDefaultCalendarVisible(
      settings({
        defaultCalendarVisibleMobile: 'false' as unknown as boolean,
      }),
      true
    )
    expect(result).toBe(false)
  })

  it('treats the string "true" as true', () => {
    const result = resolveDefaultCalendarVisible(
      settings({
        defaultCalendarVisibleMobile: 'true' as unknown as boolean,
      }),
      true
    )
    expect(result).toBe(true)
  })

  it('uses the shipped defaults: desktop on, mobile off', () => {
    expect(resolveDefaultCalendarVisible(settings(), false)).toBe(true)
    expect(resolveDefaultCalendarVisible(settings(), true)).toBe(false)
  })
})
