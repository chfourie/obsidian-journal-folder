import { describe, expect, it } from 'vitest'
import type { Signifier } from '../../../src/data-access'
import { computeSignifierLineEdit } from '../../../src/features/journal-signifiers/signifier-line-edit'

const signifiers: Signifier[] = [
  {
    id: 'priority',
    label: 'Priority',
    // First tag is the primary one inserted on add.
    tags: ['important', 'priority'],
    icon: { source: { kind: 'lucide', name: 'star' } },
  },
  {
    id: 'explore',
    label: 'Explore',
    tags: ['explore'],
    icon: { source: { kind: 'lucide', name: 'eye' } },
  },
]

describe('computeSignifierLineEdit', () => {
  it('appends the primary tag when a signifier is newly selected', () => {
    expect(
      computeSignifierLineEdit('- [ ] task', signifiers, ['priority'])
    ).toBe('- [ ] task #important')
  })

  it('strips all of a signifier’s tags when de-selected', () => {
    expect(
      computeSignifierLineEdit(
        '- [ ] task #important #priority',
        signifiers,
        []
      )
    ).toBe('- [ ] task')
  })

  it('is idempotent for an already-present selection', () => {
    const line = '- [ ] task #important'
    expect(computeSignifierLineEdit(line, signifiers, ['priority'])).toBe(line)
  })

  it('adds and removes in one pass, leaving other tags alone', () => {
    expect(
      computeSignifierLineEdit('- [ ] task #explore #keep', signifiers, [
        'priority',
      ])
    ).toBe('- [ ] task #keep #important')
  })
})
