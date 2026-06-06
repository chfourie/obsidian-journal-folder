import { describe, expect, it } from 'vitest'
import { stripFrontMatter } from '../../src/features/journal-auto-template/auto-template-content'
import {
  isJournalFileBasename,
  journalUnitForBasename,
} from '../../src/data-access/journal-note'

describe('stripFrontMatter', () => {
  it('removes a leading YAML block', () => {
    const src = '---\nfoo: bar\n---\nbody\n'
    expect(stripFrontMatter(src)).toBe('body\n')
  })

  it('returns the original string when no front matter is present', () => {
    expect(stripFrontMatter('just body\n')).toBe('just body\n')
  })

  it('does not strip a non-leading triple-dash block', () => {
    const src = 'body\n---\nnot frontmatter\n---\n'
    expect(stripFrontMatter(src)).toBe(src)
  })

  it('handles CRLF line endings', () => {
    const src = '---\r\nfoo: bar\r\n---\r\nbody\r\n'
    expect(stripFrontMatter(src)).toBe('body\r\n')
  })
})

describe('journalUnitForBasename', () => {
  it('maps each tier to its time unit', () => {
    expect(journalUnitForBasename('2026-05-07', false)).toBe('day')
    expect(journalUnitForBasename('2026-W19', false)).toBe('week')
    expect(journalUnitForBasename('2026-05', false)).toBe('month')
    expect(journalUnitForBasename('2026', false)).toBe('year')
  })

  it('returns "quarter" only when quarters are enabled', () => {
    expect(journalUnitForBasename('2026-Q2', false)).toBe(null)
    expect(journalUnitForBasename('2026-Q2', true)).toBe('quarter')
  })

  it('returns null for non-journal basenames', () => {
    expect(journalUnitForBasename('journal-folder', true)).toBe(null)
    expect(journalUnitForBasename('Untitled', true)).toBe(null)
  })
})

describe('isJournalFileBasename', () => {
  it('matches daily, weekly, monthly, and yearly basenames', () => {
    expect(isJournalFileBasename('2026-05-07', false)).toBe(true)
    expect(isJournalFileBasename('2026-W19', false)).toBe(true)
    expect(isJournalFileBasename('2026-05', false)).toBe(true)
    expect(isJournalFileBasename('2026', false)).toBe(true)
  })

  it('matches quarterly basenames only when quarters are enabled', () => {
    expect(isJournalFileBasename('2026-Q2', false)).toBe(false)
    expect(isJournalFileBasename('2026-Q2', true)).toBe(true)
  })

  it('rejects non-journal names', () => {
    expect(isJournalFileBasename('journal-folder', true)).toBe(false)
    expect(isJournalFileBasename('Untitled', true)).toBe(false)
    expect(isJournalFileBasename('2026-13-01', true)).toBe(false)
    expect(isJournalFileBasename('2026-05-32', true)).toBe(false)
  })
})
