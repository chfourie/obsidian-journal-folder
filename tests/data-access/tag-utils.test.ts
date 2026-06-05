import { describe, expect, it } from 'vitest'
import {
  extractTags,
  extractTagSpans,
  matchCategories,
  matchSignifiers,
  stripTags,
  type Signifier,
  type TaskCategory,
} from '../../src/data-access'

const signifiers: Signifier[] = [
  {
    id: 'priority',
    label: 'Priority',
    tags: ['important'],
    icon: { source: { kind: 'lucide', name: 'star' } },
  },
  {
    id: 'explore',
    label: 'Explore',
    tags: ['explore'],
    icon: { source: { kind: 'lucide', name: 'eye' } },
  },
]

const categories: TaskCategory[] = [
  { id: 'important', label: 'Important', tags: ['important'] },
  { id: 'work', label: 'Work', tags: ['work', 'job'] },
]

describe('extractTags', () => {
  it('extracts tag names without the hash, lowercased and de-duped', () => {
    expect(extractTags('a #Important b #important #explore')).toEqual([
      'important',
      'explore',
    ])
  })

  it('matches nested tags and ignores non-tag hashes', () => {
    expect(extractTags('#explore/work plus foo#bar and # heading')).toEqual([
      'explore/work',
    ])
  })

  it('returns nothing when there are no tags', () => {
    expect(extractTags('plain text only')).toEqual([])
  })
})

describe('extractTagSpans', () => {
  it('reports the [start, end) of each #tag token (excluding the boundary)', () => {
    // "Line 1 #important" — the token starts at index 7 and spans 10 chars.
    expect(extractTagSpans('Line 1 #important')).toEqual([
      { name: 'important', start: 7, end: 17 },
    ])
    expect('Line 1 #important'.slice(7, 17)).toBe('#important')
  })

  it('locates a tag at the very start of the line', () => {
    expect(extractTagSpans('#explore rest')).toEqual([
      { name: 'explore', start: 0, end: 8 },
    ])
  })

  it('reports every occurrence (no de-duplication) and handles nested tags', () => {
    const spans = extractTagSpans('#important a #important/work')
    expect(spans).toEqual([
      { name: 'important', start: 0, end: 10 },
      { name: 'important/work', start: 13, end: 28 },
    ])
  })

  it('ignores non-tag hashes (mid-word, heading)', () => {
    expect(extractTagSpans('foo#bar and # heading')).toEqual([])
  })
})

describe('matchSignifiers / matchCategories', () => {
  it('matches by tag in configuration order', () => {
    expect(matchSignifiers(['explore', 'important'], signifiers).map((s) => s.id)).toEqual([
      'priority',
      'explore',
    ])
  })

  it('treats a nested tag as a match for its ancestor', () => {
    expect(matchSignifiers(['important/work'], signifiers).map((s) => s.id)).toEqual([
      'priority',
    ])
  })

  it('matches categories on any of their tags', () => {
    expect(matchCategories(['job'], categories).map((c) => c.id)).toEqual(['work'])
  })

  it('returns empty when nothing matches', () => {
    expect(matchSignifiers(['groceries'], signifiers)).toEqual([])
  })
})

describe('stripTags', () => {
  it('removes only the named tags', () => {
    expect(stripTags('do thing #important now', ['important'])).toBe(
      'do thing now'
    )
  })

  it('keeps unrelated tags', () => {
    expect(stripTags('a #important #keep', ['important'])).toBe('a #keep')
  })

  it('removes nested descendants of a named tag', () => {
    expect(stripTags('x #important/work y', ['important'])).toBe('x y')
  })

  it('is a no-op when the tag is absent', () => {
    expect(stripTags('nothing here', ['important'])).toBe('nothing here')
  })

  it('preserves leading indentation (does not de-indent nested list items)', () => {
    // Two tabs of nesting must survive — collapsing them would jump the
    // bullet toward the top level.
    expect(stripTags('\t\t- Subtask #important', ['important'])).toBe(
      '\t\t- Subtask'
    )
    // Even with no tag removed (the empty-name / absent case still runs the
    // whitespace pass), indentation is kept.
    expect(stripTags('\t\t- Subtask', [])).toBe('\t\t- Subtask')
  })
})
