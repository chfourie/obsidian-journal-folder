import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUTO_TEMPLATE,
  resolveAutoTemplate,
  stripFrontMatter,
} from '../../src/features/journal-auto-template/auto-template-content'
import { isJournalFileBasename } from '../../src/data-access/journal-note'

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

describe('resolveAutoTemplate', () => {
  it('uses the per-folder body when present and non-empty', () => {
    const folder = '---\nfoo: bar\n---\n# Folder template\n\nhello\n'
    const result = resolveAutoTemplate(folder, 'GLOBAL')
    expect(result).toBe('# Folder template\n\nhello\n')
  })

  it('falls through to the global setting when the folder body is whitespace only', () => {
    const folder = '---\nfoo: bar\n---\n   \n'
    expect(resolveAutoTemplate(folder, 'GLOBAL')).toBe('GLOBAL')
  })

  it('falls through to the global setting when the folder body is missing', () => {
    expect(resolveAutoTemplate(null, 'GLOBAL')).toBe('GLOBAL')
  })

  it('falls through to the built-in default when neither folder nor global provide content', () => {
    expect(resolveAutoTemplate(null, '')).toBe(DEFAULT_AUTO_TEMPLATE)
    expect(resolveAutoTemplate('---\n---\n', '   ')).toBe(DEFAULT_AUTO_TEMPLATE)
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
