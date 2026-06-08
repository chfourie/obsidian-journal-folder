import { describe, expect, it } from 'vitest'
import { migrateSignifierSettings } from '../../../src/features/journal-folder-settings/migrate-signifier-settings'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../../../src/data-access'

// Build a settings object with an arbitrary signifierPlacement, bypassing the
// SignifierPlacement union so legacy/unknown values can be exercised.
function withPlacement(placement: string): JournalFolderSettings {
  return {
    ...DEFAULT_SETTINGS,
    signifierPlacement: placement,
  } as unknown as JournalFolderSettings
}

describe('migrateSignifierSettings', () => {
  it("coerces the removed legacy default 'start' to the current default", () => {
    const result = migrateSignifierSettings(withPlacement('start'))
    expect(result.signifierPlacement).toBe(DEFAULT_SETTINGS.signifierPlacement)
    expect(result.signifierPlacement).toBe('margin-column')
  })

  it("coerces the other removed in-flow value 'end' to the default", () => {
    const result = migrateSignifierSettings(withPlacement('end'))
    expect(result.signifierPlacement).toBe(DEFAULT_SETTINGS.signifierPlacement)
  })

  it('coerces any unknown value to the default', () => {
    const result = migrateSignifierSettings(withPlacement('nonsense'))
    expect(result.signifierPlacement).toBe(DEFAULT_SETTINGS.signifierPlacement)
  })

  it("leaves a valid 'margin' placement untouched", () => {
    const input = withPlacement('margin')
    const result = migrateSignifierSettings(input)
    expect(result.signifierPlacement).toBe('margin')
    expect(result).toBe(input) // unchanged reference — no needless copy
  })

  it("leaves a valid 'margin-column' placement untouched", () => {
    const input = withPlacement('margin-column')
    const result = migrateSignifierSettings(input)
    expect(result.signifierPlacement).toBe('margin-column')
    expect(result).toBe(input)
  })

  it('does not mutate the input when coercing', () => {
    const input = withPlacement('start')
    migrateSignifierSettings(input)
    expect(input.signifierPlacement).toBe('start')
  })
})
