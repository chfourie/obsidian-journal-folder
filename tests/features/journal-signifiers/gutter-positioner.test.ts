/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { describe, expect, it } from 'vitest'
import {
  columnAnchorX,
  computeColumnLeft,
  computeReserve,
  computeRowLeft,
} from '../../../src/features/journal-signifiers/gutter-positioner'

describe('computeRowLeft', () => {
  it('hangs the marker `gap` left of the entry start, relative to the host', () => {
    // host at x=100, bullet at x=80 → marker.left = 80 - 100 - 6 = -26
    expect(computeRowLeft(100, 80, 6)).toBe(-26)
  })

  it('is host-relative so it is invariant to a uniform scroll/shift', () => {
    // Shift both reference points right by 200 (e.g. window re-centred):
    // the computed host-relative offset is unchanged.
    expect(computeRowLeft(300, 280, 6)).toBe(computeRowLeft(100, 80, 6))
  })

  it('falls back to a pure `-gap` when the entry start equals the host (no bullet)', () => {
    expect(computeRowLeft(140, 140, 6)).toBe(-6)
  })
})

describe('computeColumnLeft', () => {
  it('places the marker at the shared column x, host-relative', () => {
    // columnX=40, host at x=120 (indented row) → left = 40 - 120 = -80
    expect(computeColumnLeft(120, 40)).toBe(-80)
  })

  it('gives a deeper-nested row a larger negative offset (same target column)', () => {
    const shallow = computeColumnLeft(100, 40)
    const deep = computeColumnLeft(180, 40)
    expect(deep).toBeLessThan(shallow)
  })
})

describe('columnAnchorX', () => {
  it('anchors `inset` left of the leftmost entry start', () => {
    expect(columnAnchorX([120, 80, 160], 6)).toBe(74) // min 80 - 6
  })

  it('returns null when there is nothing to anchor to', () => {
    expect(columnAnchorX([], 6)).toBeNull()
  })
})

describe('computeReserve', () => {
  it('reserves the deficit when the icon would clip past the edge', () => {
    // icon's natural left x=10, pane clip edge x=30 → must shift right by 20.
    expect(computeReserve(10, 30)).toBe(20)
  })

  it('reserves nothing when the icon already clears the edge', () => {
    // icon at x=80, clip edge at x=30 → plenty of room, no reserve.
    expect(computeReserve(80, 30)).toBe(0)
  })
})
