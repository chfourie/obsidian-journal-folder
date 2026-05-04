import { describe, expect, it } from 'vitest'
import { findInternalLinkHref } from '../../src/features/journal-header/internal-link-target'

describe('findInternalLinkHref', () => {
  it('returns the href when the target is the internal link itself', () => {
    const a = document.createElement('a')
    a.className = 'internal-link journal-folder-note-link'
    a.setAttribute('href', '2026-05-04')

    expect(findInternalLinkHref(a)).toBe('2026-05-04')
  })

  it('walks up to the nearest internal-link ancestor when the target is a descendant', () => {
    const a = document.createElement('a')
    a.className = 'internal-link'
    a.setAttribute('href', '2026-W18')
    const inner = document.createElement('span')
    a.appendChild(inner)

    expect(findInternalLinkHref(inner)).toBe('2026-W18')
  })

  it('returns null when no ancestor is an internal link', () => {
    const div = document.createElement('div')
    const button = document.createElement('button')
    div.appendChild(button)

    expect(findInternalLinkHref(button)).toBeNull()
  })

  it('returns null when the target is not an Element (e.g. document or null)', () => {
    expect(findInternalLinkHref(null)).toBeNull()
    expect(findInternalLinkHref(document)).toBeNull()
  })

  it('ignores anchors that lack the internal-link class', () => {
    const a = document.createElement('a')
    a.setAttribute('href', 'http://example.com')

    expect(findInternalLinkHref(a)).toBeNull()
  })

  it('returns null when the matched anchor has no href attribute', () => {
    const a = document.createElement('a')
    a.className = 'internal-link'

    expect(findInternalLinkHref(a)).toBeNull()
  })
})
