import { describe, expect, it } from 'vitest'
import { reorder } from '../../../src/features/journal-folder-settings/reorder-statuses'

describe('reorder', () => {
  it('moves an item forward', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item backward', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('is a no-op when from === to', () => {
    expect(reorder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('returns a shallow copy on out-of-range indices', () => {
    const input = ['a', 'b', 'c']
    const out = reorder(input, -1, 2)
    expect(out).toEqual(input)
    expect(out).not.toBe(input)
  })

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c', 'd']
    reorder(input, 0, 3)
    expect(input).toEqual(['a', 'b', 'c', 'd'])
  })
})
