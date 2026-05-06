import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { App, TFile, moment } from 'obsidian'
import {
  journalNoteFactoryWithSettings,
  type JournalNoteFactory,
} from '../../src/data-access/journal-note'
import { DEFAULT_SETTINGS } from '../../src/data-access/journal-folder-settings.type'
import { buildApp } from '../helpers/fixtures'

// "Today" used throughout — a Sunday in ISO week 18 of 2026.
const TODAY = new Date('2026-05-03T12:00:00Z')

function factory(): JournalNoteFactory {
  return journalNoteFactoryWithSettings(DEFAULT_SETTINGS)
}

function quarterFactory(): JournalNoteFactory {
  return journalNoteFactoryWithSettings({
    ...DEFAULT_SETTINGS,
    quartersEnabled: true,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('journalNoteFactoryWithSettings', () => {
  describe('strategy detection', () => {
    it('recognises daily notes (YYYY-MM-DD)', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = factory()(files['2026-05-03'])
      expect(note.getTitle()).toBe('Sunday, 03 May 2026')
    })

    it('recognises weekly notes (gggg-[W]ww)', () => {
      const { files } = buildApp('Journal', ['2026-W18'])
      const note = factory()(files['2026-W18'])
      expect(note.getTitle()).toBe('2026 Week 18')
    })

    it('recognises monthly notes (YYYY-MM)', () => {
      const { files } = buildApp('Journal', ['2026-05'])
      const note = factory()(files['2026-05'])
      expect(note.getTitle()).toBe('May 2026')
    })

    it('recognises yearly notes (YYYY)', () => {
      const { files } = buildApp('Journal', ['2026'])
      const note = factory()(files['2026'])
      expect(note.getTitle()).toBe('2026')
    })

    it('throws on a file name that does not match any strategy', () => {
      const { files } = buildApp('Journal', ['scratch'])
      expect(() => factory()(files['scratch'])).toThrow(
        /not represent a valid journal file/
      )
    })
  })

  describe('navigation', () => {
    it('moves forward by one day for a daily note', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = factory()(files['2026-05-03'])
      expect(note.forwardInTime().link().url).toBe('Journal/2026-05-04')
    })

    it('moves back by one day for a daily note', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = factory()(files['2026-05-03'])
      expect(note.backInTime().link().url).toBe('Journal/2026-05-02')
    })

    it('moves forward by one month for a monthly note', () => {
      const { files } = buildApp('Journal', ['2026-05'])
      const note = factory()(files['2026-05'])
      expect(note.forwardInTime().link().url).toBe('Journal/2026-06')
    })

    it('moves forward by one year for a yearly note', () => {
      const { files } = buildApp('Journal', ['2026'])
      const note = factory()(files['2026'])
      expect(note.forwardInTime().link().url).toBe('Journal/2027')
    })

    it('moves forward by one ISO week for a weekly note', () => {
      const { files } = buildApp('Journal', ['2026-W18'])
      const note = factory()(files['2026-W18'])
      expect(note.forwardInTime().link().url).toBe('Journal/2026-W19')
    })
  })

  describe('closestSibling', () => {
    it('returns the closest existing daily sibling after the current one', () => {
      const { files } = buildApp('Journal', [
        '2026-05-01',
        '2026-05-03',
        '2026-05-08',
        '2026-05-12',
      ])
      const note = factory()(files['2026-05-03'])
      expect(note.closestSibling('after')?.link().url).toBe('Journal/2026-05-08')
    })

    it('returns the closest existing daily sibling before the current one', () => {
      const { files } = buildApp('Journal', [
        '2026-05-01',
        '2026-05-03',
        '2026-05-08',
      ])
      const note = factory()(files['2026-05-03'])
      expect(note.closestSibling('before')?.link().url).toBe(
        'Journal/2026-05-01'
      )
    })

    it('returns undefined when there is no sibling in the requested direction', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = factory()(files['2026-05-03'])
      expect(note.closestSibling('before')).toBeUndefined()
      expect(note.closestSibling('after')).toBeUndefined()
    })

    it('ignores non-matching files when finding siblings', () => {
      const { files } = buildApp('Journal', [
        '2026-05-03',
        'random-note',
        '2026-05-04',
      ])
      const note = factory()(files['2026-05-03'])
      expect(note.closestSibling('after')?.link().url).toBe(
        'Journal/2026-05-04'
      )
    })
  })

  describe('state predicates', () => {
    it('isToday() is true for the daily note matching today', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      expect(factory()(files['2026-05-03']).isToday()).toBe(true)
    })

    it('isToday() is false for a non-daily strategy even if the period contains today', () => {
      const { files } = buildApp('Journal', ['2026-05'])
      expect(factory()(files['2026-05']).isToday()).toBe(false)
    })

    it('isPresentTime() is true for the monthly note containing today', () => {
      const { files } = buildApp('Journal', ['2026-05'])
      expect(factory()(files['2026-05']).isPresentTime()).toBe(true)
    })

    it('isPast() is true for a past daily note', () => {
      const { files } = buildApp('Journal', ['2026-05-02'])
      expect(factory()(files['2026-05-02']).isPast()).toBe(true)
    })

    it('isPast() is false for today', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      expect(factory()(files['2026-05-03']).isPast()).toBe(false)
    })

    it('isExistingNote() reflects whether a note with that basename is in the folder', () => {
      const { files } = buildApp('Journal', ['2026-05-03', '2026-05-04'])
      const note = factory()(files['2026-05-03'])
      expect(note.isExistingNote()).toBe(true)
      // Forward note (2026-05-04) also exists.
      expect(note.forwardInTime().isExistingNote()).toBe(true)
      // Two days forward (2026-05-05) does not exist.
      expect(note.forwardInTime().forwardInTime().isExistingNote()).toBe(false)
    })

    it('isPresentOrFuture() is true for today and future notes', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const today = factory()(files['2026-05-03'])
      expect(today.isPresentOrFuture()).toBe(true)
      expect(today.forwardInTime().isPresentOrFuture()).toBe(true)
      expect(today.backInTime().isPresentOrFuture()).toBe(false)
    })
  })

  describe('higher-order navigation', () => {
    it('returns YYYY → YYYY-MM → YYYY-Www links for a daily note', () => {
      // Sun 2026-05-03 sits in US-locale week 19 (weeks start on Sunday).
      const { files } = buildApp('Journal', ['2026-05-03'])
      const higher = factory()(files['2026-05-03']).getHigherOrderNotes()

      expect(higher.map((n) => n.link().url)).toEqual([
        'Journal/2026',
        'Journal/2026-05',
        'Journal/2026-W19',
      ])
    })

    it('returns one yearly link for a monthly note', () => {
      const { files } = buildApp('Journal', ['2026-05'])
      const higher = factory()(files['2026-05']).getHigherOrderNotes()
      expect(higher.map((n) => n.link().url)).toEqual(['Journal/2026'])
    })

    it('returns BOTH spanning months for a weekly note that crosses a month boundary', () => {
      // In the US-locale week numbering moment uses by default, week 18 of
      // 2026 runs Sun 2026-04-26 → Sat 2026-05-02 — crossing April/May.
      const { files } = buildApp('Journal', ['2026-W18'])
      const higher = factory()(files['2026-W18']).getHigherOrderNotes()

      expect(higher.map((n) => n.link().url)).toEqual([
        'Journal/2026',
        'Journal/2026-04',
        'Journal/2026-05',
      ])
    })

    it('returns nothing for a yearly note', () => {
      const { files } = buildApp('Journal', ['2026'])
      expect(factory()(files['2026']).getHigherOrderNotes()).toEqual([])
    })
  })

  describe('lower-order navigation', () => {
    it('returns the weekly notes contained in a monthly note', () => {
      const { files } = buildApp('Journal', ['2026-05'])
      const lower = factory()(files['2026-05']).getLowerOrderNotes()

      expect(lower.map((n) => n.link().url)).toEqual([
        'Journal/2026-W18',
        'Journal/2026-W19',
        'Journal/2026-W20',
        'Journal/2026-W21',
        'Journal/2026-W22',
      ])
    })

    it('returns the monthly notes contained in a yearly note', () => {
      const { files } = buildApp('Journal', ['2026'])
      const lower = factory()(files['2026']).getLowerOrderNotes()

      expect(lower).toHaveLength(12)
      expect(lower[0].link().url).toBe('Journal/2026-01')
      expect(lower[11].link().url).toBe('Journal/2026-12')
    })

    it('returns the daily notes contained in a weekly note', () => {
      // US-locale week 18 of 2026 = Sun 2026-04-26 → Sat 2026-05-02.
      const { files } = buildApp('Journal', ['2026-W18'])
      const lower = factory()(files['2026-W18']).getLowerOrderNotes()

      expect(lower).toHaveLength(7)
      expect(lower[0].link().url).toBe('Journal/2026-04-26')
      expect(lower[6].link().url).toBe('Journal/2026-05-02')
    })

    it('returns nothing for a daily note', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      expect(factory()(files['2026-05-03']).getLowerOrderNotes()).toEqual([])
    })
  })

  describe('link()', () => {
    it('produces a link object with title, url, needsConfirmation', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const link = factory()(files['2026-05-03']).link('regular')
      expect(link).toEqual({
        title: 'Sunday, 03 May 2026',
        url: 'Journal/2026-05-03',
        needsConfirmation: false,
      })
    })

    it('uses the short pattern by default', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const link = factory()(files['2026-05-03']).link()
      expect(link.title).toBe('Sun, 3 May')
    })

    it('passes through the needsConfirmation flag', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const link = factory()(files['2026-05-03']).link('short', true)
      expect(link.needsConfirmation).toBe(true)
    })
  })

  describe('shortLinkFrom()', () => {
    it('uses the short title pattern when source and target share a year', () => {
      const { files } = buildApp('Journal', ['2026-05-03', '2026-08-15'])
      const source = factory()(files['2026-05-03'])
      const target = factory()(files['2026-08-15'])
      expect(target.shortLinkFrom(source).title).toBe('Sat, 15 Aug')
    })

    it('uses the medium title pattern when source and target are in different years', () => {
      const { files } = buildApp('Journal', ['2025-12-31', '2026-05-03'])
      const source = factory()(files['2025-12-31'])
      const target = factory()(files['2026-05-03'])
      expect(target.shortLinkFrom(source).title).toBe('Sun, 3 May 26')
    })
  })

  describe('dailyNoteToday()', () => {
    it('returns the daily note for today regardless of source strategy', () => {
      const { files } = buildApp('Journal', ['2026'])
      const yearly = factory()(files['2026'])
      expect(yearly.dailyNoteToday().link().url).toBe('Journal/2026-05-03')
    })
  })

  describe('getFolderName()', () => {
    it('returns the parent folder name', () => {
      const { files } = buildApp('My Journal', ['2026-05-03'])
      expect(factory()(files['2026-05-03']).getFolderName()).toBe('My Journal')
    })
  })

  describe('quarterly notes (quartersEnabled)', () => {
    it('does not recognise YYYY-Q[1-4] when quarters are disabled', () => {
      const { files } = buildApp('Journal', ['2026-Q2'])
      expect(() => factory()(files['2026-Q2'])).toThrow(
        /not represent a valid journal file/
      )
    })

    it('recognises YYYY-Q[1-4] when quarters are enabled', () => {
      const { files } = buildApp('Journal', ['2026-Q2'])
      const note = quarterFactory()(files['2026-Q2'])
      expect(note.getTitle()).toBe('2026 Q2')
      expect(note.getTimeUnit()).toBe('quarter')
    })

    it.each([
      ['2026-Q1', '2026-04-01'],
      ['2026-Q2', '2026-07-01'],
      ['2026-Q3', '2026-10-01'],
    ])('moves forward by one quarter (%s → next)', (basename, expectedStart) => {
      const { files } = buildApp('Journal', [basename])
      const note = quarterFactory()(files[basename])
      const next = note.forwardInTime()
      // Next quarter's start matches expectedStart.
      expect(next.getMoment().format('YYYY-MM-DD')).toBe(expectedStart)
    })

    it('moves back by one quarter, wrapping the year', () => {
      const { files } = buildApp('Journal', ['2026-Q1'])
      const note = quarterFactory()(files['2026-Q1'])
      expect(note.backInTime().link().url).toBe('Journal/2025-Q4')
    })

    it('isPresentTime() is true for the quarter containing today', () => {
      // TODAY = 2026-05-03 → Q2 of 2026.
      const { files } = buildApp('Journal', ['2026-Q2'])
      expect(quarterFactory()(files['2026-Q2']).isPresentTime()).toBe(true)
    })

    it('isPast() is true for a past quarter', () => {
      const { files } = buildApp('Journal', ['2026-Q1'])
      expect(quarterFactory()(files['2026-Q1']).isPast()).toBe(true)
    })

    describe('higher-order navigation', () => {
      it('inserts the quarter between year and month for a daily note', () => {
        const { files } = buildApp('Journal', ['2026-05-03'])
        const higher = quarterFactory()(files['2026-05-03']).getHigherOrderNotes()
        expect(higher.map((n) => n.link().url)).toEqual([
          'Journal/2026',
          'Journal/2026-Q2',
          'Journal/2026-05',
          'Journal/2026-W19',
        ])
      })

      it('returns year + quarter for a monthly note', () => {
        const { files } = buildApp('Journal', ['2026-05'])
        const higher = quarterFactory()(files['2026-05']).getHigherOrderNotes()
        expect(higher.map((n) => n.link().url)).toEqual([
          'Journal/2026',
          'Journal/2026-Q2',
        ])
      })

      it('returns just the year for a quarterly note', () => {
        const { files } = buildApp('Journal', ['2026-Q2'])
        const higher = quarterFactory()(files['2026-Q2']).getHigherOrderNotes()
        expect(higher.map((n) => n.link().url)).toEqual(['Journal/2026'])
      })

      it('returns BOTH overlapping quarters for a weekly note that crosses a quarter boundary', () => {
        // US-locale week 14 of 2026 runs Sun 2026-03-29 → Sat 2026-04-04,
        // which spans Q1 and Q2.
        const { files } = buildApp('Journal', ['2026-W14'])
        const higher = quarterFactory()(files['2026-W14']).getHigherOrderNotes()
        const urls = higher.map((n) => n.link().url)
        expect(urls).toContain('Journal/2026-Q1')
        expect(urls).toContain('Journal/2026-Q2')
      })
    })

    describe('lower-order navigation', () => {
      it('returns the three months in the quarter for a quarterly note', () => {
        const { files } = buildApp('Journal', ['2026-Q2'])
        const lower = quarterFactory()(files['2026-Q2']).getLowerOrderNotes()
        expect(lower.map((n) => n.link().url)).toEqual([
          'Journal/2026-04',
          'Journal/2026-05',
          'Journal/2026-06',
        ])
      })

      it('keeps the 12 months as the primary lower-order list for yearly notes when quarters are enabled', () => {
        // Quarters get their own dedicated section in the More panel —
        // they don't replace the Month list, which is the most useful
        // navigation surface from a yearly note.
        const { files } = buildApp('Journal', ['2026'])
        const lower = quarterFactory()(files['2026']).getLowerOrderNotes()
        expect(lower).toHaveLength(12)
        expect(lower[0].link().url).toBe('Journal/2026-01')
        expect(lower[11].link().url).toBe('Journal/2026-12')
      })
    })

    describe('getNotesInPeriod()', () => {
      it('returns the four quarters of a yearly note', () => {
        const { files } = buildApp('Journal', ['2026'])
        const quarters = quarterFactory()(files['2026']).getNotesInPeriod(
          'quarter'
        )
        expect(quarters.map((n) => n.link().url)).toEqual([
          'Journal/2026-Q1',
          'Journal/2026-Q2',
          'Journal/2026-Q3',
          'Journal/2026-Q4',
        ])
      })

      it('returns the 12 months of a yearly note via getNotesInPeriod("month")', () => {
        const { files } = buildApp('Journal', ['2026'])
        const months = quarterFactory()(files['2026']).getNotesInPeriod('month')
        expect(months).toHaveLength(12)
        expect(months[0].link().url).toBe('Journal/2026-01')
        expect(months[11].link().url).toBe('Journal/2026-12')
      })

      it('returns [] for a unit not active in the chain (quarter when disabled)', () => {
        const { files } = buildApp('Journal', ['2026'])
        const quarters = factory()(files['2026']).getNotesInPeriod('quarter')
        expect(quarters).toEqual([])
      })

      it('returns [] when the requested unit is the same tier as the note', () => {
        const { files } = buildApp('Journal', ['2026'])
        const sameTier = quarterFactory()(files['2026']).getNotesInPeriod('year')
        expect(sameTier).toEqual([])
      })

      it('returns [] when the requested unit is higher than the note', () => {
        const { files } = buildApp('Journal', ['2026-05-03'])
        const higher = quarterFactory()(files['2026-05-03']).getNotesInPeriod(
          'year'
        )
        expect(higher).toEqual([])
      })
    })

    describe('hasUnit()', () => {
      it('reports quarter as available when quarters are enabled', () => {
        const { files } = buildApp('Journal', ['2026-05-03'])
        const note = quarterFactory()(files['2026-05-03'])
        expect(note.hasUnit('quarter')).toBe(true)
      })

      it('reports quarter as unavailable when quarters are disabled', () => {
        const { files } = buildApp('Journal', ['2026-05-03'])
        const note = factory()(files['2026-05-03'])
        expect(note.hasUnit('quarter')).toBe(false)
      })

      it('reports the standard tiers regardless of quarter setting', () => {
        const { files } = buildApp('Journal', ['2026-05-03'])
        const note = factory()(files['2026-05-03'])
        for (const unit of ['day', 'week', 'month', 'year'] as const) {
          expect(note.hasUnit(unit)).toBe(true)
        }
      })
    })

    it('treats the front-matter string "true" as enabling quarters', () => {
      // FolderSettingsResolver merges raw front-matter values into settings,
      // so a YAML string survives as the literal "true". Match the existing
      // truthy-string convention used for default-calendar-visible.
      const note = journalNoteFactoryWithSettings({
        ...DEFAULT_SETTINGS,
        // @ts-ignore — runtime value comes from user-supplied front matter.
        quartersEnabled: 'true',
      })(buildApp('Journal', ['2026-Q2']).files['2026-Q2'])
      expect(note.getTitle()).toBe('2026 Q2')
    })

    it('treats the front-matter string "false" as disabling quarters', () => {
      expect(() =>
        journalNoteFactoryWithSettings({
          ...DEFAULT_SETTINGS,
          // @ts-ignore — runtime value comes from user-supplied front matter.
          quartersEnabled: 'false',
        })(buildApp('Journal', ['2026-Q2']).files['2026-Q2'])
      ).toThrow(/not represent a valid journal file/)
    })

    it('builds a quarterly note via noteFor("quarter", moment) regardless of source strategy', () => {
      const { files } = buildApp('Journal', ['2026-05-03'])
      const note = quarterFactory()(files['2026-05-03'])
      // @ts-ignore — moment() acts as both a function and namespace at runtime.
      const m = moment('2026-05-15')
      const quarter = note.noteFor('quarter', m)
      expect(quarter.link().url).toBe('Journal/2026-Q2')
    })
  })

  describe('parent path handling', () => {
    it('returns a path-less url when the note has no parent path', () => {
      const app = new App()
      const file = new TFile()
      file.basename = '2026-05-03'
      file.name = '2026-05-03.md'
      file.path = '2026-05-03.md'
      file.parent = null
      app.vault.addFile(file)

      const note = factory()(file)
      expect(note.link().url).toBe('2026-05-03')
    })
  })
})
