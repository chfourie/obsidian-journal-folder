import { describe, expect, it } from 'vitest'
import { findLucideMarkerSpans } from '../../../src/features/journal-tasks/migration-reference-live-preview'

const TO = 'lucide:redo-dot'
const FROM = 'lucide:undo-dot'
const markers = [TO, FROM]

describe('findLucideMarkerSpans', () => {
  it('finds a lucide marker that precedes a wikilink', () => {
    const text = `- [>] Buy milk ${TO} [[2026-06-09]]`
    const start = text.indexOf(TO)
    expect(findLucideMarkerSpans(text, markers)).toEqual([
      { from: start, to: start + TO.length, name: 'redo-dot' },
    ])
  })

  it('matches the "from" marker too', () => {
    const text = `- [ ] Buy milk ${FROM} [[2026-06-08]]`
    const start = text.indexOf(FROM)
    expect(findLucideMarkerSpans(text, markers)).toEqual([
      { from: start, to: start + FROM.length, name: 'undo-dot' },
    ])
  })

  it('ignores a lucide token that is NOT followed by a wikilink', () => {
    const text = `- [ ] talk about ${TO} the icon syntax`
    expect(findLucideMarkerSpans(text, markers)).toEqual([])
  })

  it('ignores a non-standalone token (no whitespace boundary before)', () => {
    const text = `- [ ] xx${TO} [[2026-06-09]]`
    expect(findLucideMarkerSpans(text, markers)).toEqual([])
  })

  it('requires whitespace between the marker and the link', () => {
    const text = `- [ ] done ${TO}[[2026-06-09]]`
    expect(findLucideMarkerSpans(text, markers)).toEqual([])
  })

  it('ignores non-lucide (text / emoji) markers', () => {
    const text = `- [ ] done -> [[2026-06-09]]`
    expect(findLucideMarkerSpans(text, ['->', '⤴️'])).toEqual([])
  })

  it('skips empty / blank markers', () => {
    const text = `- [ ] done ${TO} [[2026-06-09]]`
    const start = text.indexOf(TO)
    expect(findLucideMarkerSpans(text, [TO, '', '   '])).toEqual([
      { from: start, to: start + TO.length, name: 'redo-dot' },
    ])
  })

  it('finds multiple references on one line, sorted by position', () => {
    const text = `- [ ] x ${TO} [[a]] and ${FROM} [[b]]`
    const first = text.indexOf(TO)
    const second = text.indexOf(FROM)
    expect(findLucideMarkerSpans(text, markers)).toEqual([
      { from: first, to: first + TO.length, name: 'redo-dot' },
      { from: second, to: second + FROM.length, name: 'undo-dot' },
    ])
  })

  it('matches a marker at the very start of the text', () => {
    const text = `${TO} [[2026-06-09]]`
    expect(findLucideMarkerSpans(text, markers)).toEqual([
      { from: 0, to: TO.length, name: 'redo-dot' },
    ])
  })
})
