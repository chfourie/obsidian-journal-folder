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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COLUMN_INSET_PX,
  EDGE_MARGIN_PX,
  ROW_GAP_PX,
  columnAnchorX,
  computeColumnLeft,
  computeReserve,
  computeRowLeft,
  maxGutterReserve,
  scheduleReadingGutters,
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

describe('maxGutterReserve', () => {
  it('bounds the lane to the icon-stack width plus the gaps', () => {
    expect(maxGutterReserve(40)).toBe(
      40 + ROW_GAP_PX + COLUMN_INSET_PX + EDGE_MARGIN_PX
    )
  })

  it('clamps a runaway deficit so content can never be pushed off screen', () => {
    // A corrupt mid-resize measurement asks for a 9999px lane; the real icon
    // stack is 48px wide, so the lane is capped at its intrinsic extent.
    const corruptDeficit = 9999
    const clamped = Math.min(corruptDeficit, maxGutterReserve(48))
    expect(clamped).toBe(48 + ROW_GAP_PX + COLUMN_INSET_PX + EDGE_MARGIN_PX)
    expect(clamped).toBeLessThan(100)
  })
})

describe('scheduleReadingGutters', () => {
  let frames: FrameRequestCallback[]

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  // A container with no markers so the positioner reads nothing and returns
  // early — we're only exercising the rAF scheduling, not layout.
  function emptyContainer(): HTMLElement {
    return { isConnected: true, querySelectorAll: () => [] } as unknown as HTMLElement
  }

  // Run every currently-queued frame callback (each may queue more).
  function runFrame(): void {
    const pending = frames
    frames = []
    for (const cb of pending) cb(0)
  }

  it('runs a single pass and arms no further frames', () => {
    scheduleReadingGutters(emptyContainer(), 'margin-column', true)
    expect(frames.length).toBe(1) // one frame armed

    runFrame() // the pass runs and arms nothing further (no confirm chain)
    expect(frames.length).toBe(0)
  })

  it('coalesces repeated requests into a single frame', () => {
    const c = emptyContainer()
    scheduleReadingGutters(c, 'margin-column', true)
    scheduleReadingGutters(c, 'margin-column', true)
    scheduleReadingGutters(c, 'margin-column', true)
    expect(frames.length).toBe(1)
    runFrame()
    expect(frames.length).toBe(0)
  })

  it('does nothing for a non-margin placement', () => {
    scheduleReadingGutters(emptyContainer(), 'start' as never, true)
    expect(frames.length).toBe(0)
  })
})
