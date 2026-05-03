import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildJournalHeaderInfo } from '../../src/features/journal-header/journal-header-info'
import { journalNoteFactoryWithSettings } from '../../src/data-access/journal-note'
import { DEFAULT_SETTINGS } from '../../src/data-access/journal-folder-settings.type'
import { buildApp } from '../helpers/fixtures'

const TODAY = new Date('2026-05-03T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('buildJournalHeaderInfo', () => {
  it('uses the note title and resolves higher-order/secondary links', () => {
    const { files } = buildApp('Journal', ['2026-05-03'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-03']
    )

    const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

    expect(info.title).toBe('Sunday, 03 May 2026')
    // Higher-order present-time chips are always shown. Sun 2026-05-03 sits
    // in US-locale week 19 (weeks start on Sunday).
    expect(info.centerLinks.map((l) => l.title)).toEqual(['2026', 'May', 'W19'])
    // No "Today" chip because we ARE on today.
    expect(info.secondaryLinks).toEqual([])
  })

  it('appends a [Today] chip to centerLinks when the current note is not today', () => {
    const { files } = buildApp('Journal', ['2026-05-02'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-02']
    )

    const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

    expect(info.centerLinks.at(-1)).toEqual({
      title: 'Today',
      url: 'Journal/2026-05-03',
      inactive: false,
    })
  })

  it('emits secondary links for lower-order periods', () => {
    const { files } = buildApp('Journal', ['2026-05'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05']
    )

    const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

    expect(info.secondaryLinks.map((l) => l.url)).toEqual([
      'Journal/2026-W18',
      'Journal/2026-W19',
      'Journal/2026-W20',
      'Journal/2026-W21',
      'Journal/2026-W22',
    ])
  })

  it('marks past missing lower-order notes as inactive', () => {
    // 2026-04 is fully in the past relative to 2026-05-03; none of its weekly
    // notes exist on disk, so each secondary link should be inactive.
    const { files } = buildApp('Journal', ['2026-04'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-04']
    )

    const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

    expect(info.secondaryLinks.length).toBeGreaterThan(0)
    expect(info.secondaryLinks.every((l) => l.inactive === true)).toBe(true)
  })

  it('keeps future missing lower-order notes active (not inactive)', () => {
    const { files } = buildApp('Journal', ['2026-07'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-07']
    )

    const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

    expect(info.secondaryLinks.every((l) => l.inactive === false)).toBe(true)
  })

  describe('forward link', () => {
    it('uses the direct sibling when it exists', () => {
      const { files } = buildApp('Journal', ['2026-05-03', '2026-05-04'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.forwardLink?.url).toBe('Journal/2026-05-04')
    })

    it('falls back to the next existing note when the direct sibling is past and missing', () => {
      // Today is 2026-05-03. 2026-05-01 is past; its forward sibling 2026-05-02
      // is missing AND past, so the fallback should be the closest later
      // existing note in the folder.
      const { files } = buildApp('Journal', ['2026-05-01', '2026-05-08'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-01']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.forwardLink?.url).toBe('Journal/2026-05-08')
    })

    it('uses the direct future sibling even when it does not exist on disk', () => {
      // Today is 2026-05-03 → 2026-05-04 is future, so it counts as
      // "presentOrFuture" and is preferred over a closestSibling lookup.
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.forwardLink?.url).toBe('Journal/2026-05-04')
    })
  })

  describe('backward link', () => {
    it('uses the direct previous sibling when it exists', () => {
      const { files } = buildApp('Journal', ['2026-05-02', '2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.backwardLink?.url).toBe('Journal/2026-05-02')
    })

    it('falls back to the closest earlier existing note when direct sibling is past and missing', () => {
      const { files } = buildApp('Journal', ['2026-04-20', '2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.backwardLink?.url).toBe('Journal/2026-04-20')
    })

    it('returns undefined when there is no earlier note at all', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      // 2026-05-02 is missing AND past → no fallback either.
      expect(info.backwardLink).toBeUndefined()
    })
  })

  describe('journalFolderTitle', () => {
    it('uses settings.journalFolderTitle when set', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(
        { ...DEFAULT_SETTINGS, journalFolderTitle: 'Captain’s Log' },
        note
      )

      expect(info.journalFolderTitle).toBe('Captain’s Log')
    })

    it('falls back to the folder name when useFolderNameAsDefaultTitle is true and title is empty', () => {
      const { files } = buildApp('Daily Notes', ['2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(
        {
          ...DEFAULT_SETTINGS,
          journalFolderTitle: '',
          useFolderNameAsDefaultTitle: true,
        },
        note
      )

      expect(info.journalFolderTitle).toBe('Daily Notes')
    })

    it('returns undefined when no title is configured and the folder fallback is off', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)
      expect(info.journalFolderTitle).toBeUndefined()
    })
  })
})
