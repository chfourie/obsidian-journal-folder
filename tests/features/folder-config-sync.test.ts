import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../../src/data-access'
import {
  computeFrontMatterDiff,
  PER_FOLDER_FIELDS,
} from '../../src/features/journal-folder-sidebar/folder-config-sync'

function settings(
  overrides: Partial<JournalFolderSettings> = {}
): JournalFolderSettings {
  return { ...DEFAULT_SETTINGS, ...overrides }
}

describe('computeFrontMatterDiff', () => {
  it('removes every per-folder key when the new settings match global', () => {
    const global = settings({ dailyNoteTitlePattern: 'CUSTOM' })
    const next = { ...global }
    const diff = computeFrontMatterDiff(next, global)
    expect(diff.set).toEqual({})
    // Every per-folder field is staged for removal so a previously-set
    // key in the front matter gets cleared rather than left behind.
    expect(diff.remove.length).toBe(PER_FOLDER_FIELDS.length)
  })

  it('sets only the keys that differ from global', () => {
    const global = settings()
    const next = settings({
      dailyNoteTitlePattern: 'NEW',
      quartersEnabled: true,
    })
    const diff = computeFrontMatterDiff(next, global)
    expect(diff.set).toEqual({
      'daily-note-title-pattern': 'NEW',
      'quarters-enabled': true,
    })
  })

  it('treats string "true"/"false" as equal to boolean global', () => {
    const global = settings({ quartersEnabled: true })
    // simulate front-matter source where the value came in as a string
    const next = settings({ ...global, quartersEnabled: 'true' as unknown as boolean })
    const diff = computeFrontMatterDiff(next, global)
    expect(diff.set).not.toHaveProperty('quarters-enabled')
    expect(diff.remove).toContain('quarters-enabled')
  })

  it('uses kebab-cased keys for set entries', () => {
    const global = settings()
    const next = settings({
      defaultCalendarVisibleDesktop: false,
      autoTemplateContent: 'CUSTOM',
    })
    const diff = computeFrontMatterDiff(next, global)
    expect(Object.keys(diff.set).sort()).toEqual([
      'auto-template-content',
      'default-calendar-visible-desktop',
    ])
  })
})
