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
    // Higher-order present-time chips live in moreLinks and use the regular
    // (long) title pattern. Sun 2026-05-03 sits in US-locale week 19.
    expect(info.moreLinks.map((l) => l.title)).toEqual([
      '2026',
      'May 2026',
      '2026 Week 19',
    ])
    // No "Today" link because we ARE on today.
    expect(info.todayLink).toBeUndefined()
    expect(info.secondaryLinks).toEqual([])
  })

  it('exposes a [Today] link when the current note is not today', () => {
    const { files } = buildApp('Journal', ['2026-05-02'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-02']
    )

    const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

    expect(info.todayLink).toEqual({
      title: 'Today',
      url: 'Journal/2026-05-03',
      inactive: false,
    })
  })

  it('keeps the Today link out of moreLinks so it stays in the primary row', () => {
    const { files } = buildApp('Journal', ['2026-05-02'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026-05-02']
    )

    const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

    expect(info.moreLinks.some((l) => l.title === 'Today')).toBe(false)
  })

  it('returns an empty moreLinks array for yearly notes (no higher-order periods)', () => {
    const { files } = buildApp('Journal', ['2026'])
    const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
      files['2026']
    )

    const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

    expect(info.moreLinks).toEqual([])
  })

  describe('section labels', () => {
    it('uses a generic "Jump to" label for the higher-order chips section (it also hosts the calendar toggle)', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.moreLinksLabel).toBe('Jump to')
    })

    it('labels the secondary list "Month" on a yearly note', () => {
      const { files } = buildApp('Journal', ['2026'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.secondaryLinksLabel).toBe('Month')
    })

    it('labels the secondary list "Week" on a monthly note', () => {
      const { files } = buildApp('Journal', ['2026-05'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.secondaryLinksLabel).toBe('Week')
    })

    it('labels the secondary list "Day" on a weekly note', () => {
      const { files } = buildApp('Journal', ['2026-W19'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-W19']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.secondaryLinksLabel).toBe('Day')
    })

    it('returns an empty secondary label for daily notes (no lower-order period)', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )

      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)

      expect(info.secondaryLinksLabel).toBe('')
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

  describe('quartersEnabled', () => {
    const QUARTER_SETTINGS = { ...DEFAULT_SETTINGS, quartersEnabled: true }

    it('lists the overlapping quarter in moreLinks for a daily note', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = journalNoteFactoryWithSettings(QUARTER_SETTINGS)(
        files['2026-05-03']
      )
      const info = buildJournalHeaderInfo(QUARTER_SETTINGS, note)

      expect(info.moreLinks.map((l) => l.title)).toEqual([
        '2026',
        '2026 Q2',
        'May 2026',
        '2026 Week 19',
      ])
    })

    it('lists year + quarter in moreLinks for a monthly note', () => {
      const { files } = buildApp('Journal', ['2026-05'])
      const note = journalNoteFactoryWithSettings(QUARTER_SETTINGS)(
        files['2026-05']
      )
      const info = buildJournalHeaderInfo(QUARTER_SETTINGS, note)
      expect(info.moreLinks.map((l) => l.title)).toEqual(['2026', '2026 Q2'])
    })

    it('lists the months contained by a quarterly note as secondary links', () => {
      const { files } = buildApp('Journal', ['2026-Q2'])
      const note = journalNoteFactoryWithSettings(QUARTER_SETTINGS)(
        files['2026-Q2']
      )
      const info = buildJournalHeaderInfo(QUARTER_SETTINGS, note)
      expect(info.secondaryLinks.map((l) => l.url)).toEqual([
        'Journal/2026-04',
        'Journal/2026-05',
        'Journal/2026-06',
      ])
      expect(info.secondaryLinksLabel).toBe('Month')
    })

    it('keeps the 12 months as the primary secondary list for a yearly note', () => {
      const { files } = buildApp('Journal', ['2026'])
      const note = journalNoteFactoryWithSettings(QUARTER_SETTINGS)(
        files['2026']
      )
      const info = buildJournalHeaderInfo(QUARTER_SETTINGS, note)
      expect(info.secondaryLinks).toHaveLength(12)
      expect(info.secondaryLinks[0].url).toBe('Journal/2026-01')
      expect(info.secondaryLinks[11].url).toBe('Journal/2026-12')
      expect(info.secondaryLinksLabel).toBe('Month')
    })

    it('exposes the four overlapping quarters as extraLinks for a yearly note', () => {
      const { files } = buildApp('Journal', ['2026'])
      const note = journalNoteFactoryWithSettings(QUARTER_SETTINGS)(
        files['2026']
      )
      const info = buildJournalHeaderInfo(QUARTER_SETTINGS, note)
      expect(info.extraLinks.map((l) => l.url)).toEqual([
        'Journal/2026-Q1',
        'Journal/2026-Q2',
        'Journal/2026-Q3',
        'Journal/2026-Q4',
      ])
      expect(info.extraLinksLabel).toBe('Quarter')
    })

    it('does not populate extraLinks for non-yearly note types', () => {
      const { files } = buildApp('Journal', ['2026-05', '2026-Q2', '2026-W19', '2026-05-03'])
      for (const basename of ['2026-05', '2026-Q2', '2026-W19', '2026-05-03']) {
        const note = journalNoteFactoryWithSettings(QUARTER_SETTINGS)(
          files[basename]
        )
        const info = buildJournalHeaderInfo(QUARTER_SETTINGS, note)
        expect(info.extraLinks, `extraLinks for ${basename}`).toEqual([])
        expect(info.extraLinksLabel, `extraLinksLabel for ${basename}`).toBe('')
      }
    })

    it('does not populate extraLinks for a yearly note when quarters are disabled', () => {
      const { files } = buildApp('Journal', ['2026'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026']
      )
      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)
      expect(info.extraLinks).toEqual([])
      expect(info.extraLinksLabel).toBe('')
    })

    it('uses the quarterly note title for the heading', () => {
      const { files } = buildApp('Journal', ['2026-Q2'])
      const note = journalNoteFactoryWithSettings(QUARTER_SETTINGS)(
        files['2026-Q2']
      )
      const info = buildJournalHeaderInfo(QUARTER_SETTINGS, note)
      expect(info.title).toBe('2026 Q2')
    })

    it('lists BOTH overlapping quarters in moreLinks for a weekly note that crosses the Q1/Q2 boundary', () => {
      // US-locale week 14 of 2026 runs Sun 2026-03-29 → Sat 2026-04-04 and
      // straddles the Q1/Q2 boundary. Both quarters must appear in the More
      // panel even though Q1 is past and missing on disk.
      const { files } = buildApp('Journal', ['2026-W14'])
      const note = journalNoteFactoryWithSettings(QUARTER_SETTINGS)(
        files['2026-W14']
      )
      const info = buildJournalHeaderInfo(QUARTER_SETTINGS, note)
      const titles = info.moreLinks.map((l) => l.title)
      expect(titles).toContain('2026 Q1')
      expect(titles).toContain('2026 Q2')
      // Both spanning months must also appear.
      expect(titles).toContain('March 2026')
      expect(titles).toContain('April 2026')
    })

    it('marks past+missing entries from a spanning tier as inactive', () => {
      const { files } = buildApp('Journal', ['2026-W14'])
      const note = journalNoteFactoryWithSettings(QUARTER_SETTINGS)(
        files['2026-W14']
      )
      const info = buildJournalHeaderInfo(QUARTER_SETTINGS, note)
      const q1 = info.moreLinks.find((l) => l.title === '2026 Q1')!
      const q2 = info.moreLinks.find((l) => l.title === '2026 Q2')!
      expect(q1.inactive).toBe(true)
      expect(q2.inactive).toBe(false)
    })

    it('does not surface the quarter in moreLinks when quarters are disabled', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(
        files['2026-05-03']
      )
      const info = buildJournalHeaderInfo(DEFAULT_SETTINGS, note)
      expect(info.moreLinks.some((l) => /Q\d/.test(l.title))).toBe(false)
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
