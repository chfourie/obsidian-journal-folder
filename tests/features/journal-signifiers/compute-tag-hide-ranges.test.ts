import { describe, expect, it } from 'vitest'
import { computeTagHideRanges } from '../../../src/features/journal-signifiers/signifier-live-preview'

// Line spans doc offsets [0, 40); two signifier tags on it.
const LINE_FROM = 0
const LINE_TO = 40
const tagA = { from: 7, to: 17 } // "#important"
const tagB = { from: 20, to: 28 } // "#explore"
const tags = [tagA, tagB]

describe('computeTagHideRanges', () => {
  it('hides every tag when the selection is off the line', () => {
    const sel = [{ from: 100, to: 100 }]
    expect(computeTagHideRanges(LINE_FROM, LINE_TO, tags, sel, true)).toEqual(
      tags
    )
    expect(computeTagHideRanges(LINE_FROM, LINE_TO, tags, sel, false)).toEqual(
      tags
    )
  })

  describe('reveal-on-active-line ON', () => {
    it('reveals ALL tags when the cursor is anywhere on the line', () => {
      // Cursor at offset 3 — on the line but not on either tag.
      const sel = [{ from: 3, to: 3 }]
      expect(computeTagHideRanges(LINE_FROM, LINE_TO, tags, sel, true)).toEqual(
        []
      )
    })

    it('reveals all tags when a selection overlaps the line at all', () => {
      const sel = [{ from: 30, to: 38 }]
      expect(computeTagHideRanges(LINE_FROM, LINE_TO, tags, sel, true)).toEqual(
        []
      )
    })
  })

  describe('reveal-on-active-line OFF (per-tag touch)', () => {
    it('reveals only the tag the cursor touches, hides the rest', () => {
      // Cursor inside tagA.
      const sel = [{ from: 10, to: 10 }]
      expect(
        computeTagHideRanges(LINE_FROM, LINE_TO, tags, sel, false)
      ).toEqual([tagB])
    })

    it('keeps both hidden when the cursor is on the line but on neither tag', () => {
      const sel = [{ from: 3, to: 3 }]
      expect(
        computeTagHideRanges(LINE_FROM, LINE_TO, tags, sel, false)
      ).toEqual(tags)
    })

    it('treats a cursor at a tag boundary as touching it', () => {
      // Caret exactly at tagB.from — inclusive boundary reveals it.
      const sel = [{ from: tagB.from, to: tagB.from }]
      expect(
        computeTagHideRanges(LINE_FROM, LINE_TO, tags, sel, false)
      ).toEqual([tagA])
    })
  })
})
