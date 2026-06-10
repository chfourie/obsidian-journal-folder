import { describe, expect, it } from 'vitest'
import { resolveTodayFolders } from '../../../src/features/journal-today/resolve-today-folders'

describe('resolveTodayFolders', () => {
  const includeNone = () => false
  const includeAll = () => true

  it('returns nothing when there are no known journal folders', () => {
    expect(resolveTodayFolders([], includeNone)).toEqual([])
    expect(resolveTodayFolders([], includeAll)).toEqual([])
  })

  it('always includes a single known folder, even when it has not opted in', () => {
    expect(resolveTodayFolders(['Journal'], includeNone)).toEqual(['Journal'])
  })

  it('still returns the single folder when it has opted in', () => {
    expect(resolveTodayFolders(['Journal'], includeAll)).toEqual(['Journal'])
  })

  it('offers all folders when several exist but none opted in', () => {
    const folders = ['Work', 'Home', 'Travel']
    expect(resolveTodayFolders(folders, includeNone)).toEqual(folders)
  })

  it('offers only the opted-in folders when some have opted in', () => {
    const folders = ['Work', 'Home', 'Travel']
    const optedIn = new Set(['Home', 'Travel'])
    expect(
      resolveTodayFolders(folders, (p) => optedIn.has(p))
    ).toEqual(['Home', 'Travel'])
  })

  it('offers a single opted-in folder out of many (caller then opens it directly)', () => {
    const folders = ['Work', 'Home', 'Travel']
    expect(
      resolveTodayFolders(folders, (p) => p === 'Work')
    ).toEqual(['Work'])
  })

  it('preserves the input order of the known folders', () => {
    const folders = ['Z', 'A', 'M']
    expect(resolveTodayFolders(folders, includeAll)).toEqual(['Z', 'A', 'M'])
  })
})
