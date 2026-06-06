import { describe, expect, it } from 'vitest'
import {
  computeMenuPanelPosition,
  type AnchorRect,
} from '../../src/features/journal-folder-sidebar/menu-panel-position'

const viewport = { width: 1000, height: 800 }

function anchor(overrides: Partial<AnchorRect> = {}): AnchorRect {
  return { top: 100, left: 40, right: 80, bottom: 130, width: 40, ...overrides }
}

describe('computeMenuPanelPosition — below (sidebar menus)', () => {
  it('right-aligns the panel under the trigger by default', () => {
    const { top, left } = computeMenuPanelPosition({
      anchor: anchor({ left: 400, right: 500, bottom: 130 }),
      panel: { width: 200, height: 150 },
      viewport,
      placement: 'below',
    })
    expect(top).toBe(136) // bottom (130) + gap (6)
    expect(left).toBe(300) // right (500) - width (200)
  })

  it('left-aligns when align is left', () => {
    const { left } = computeMenuPanelPosition({
      anchor: anchor({ left: 400, right: 500 }),
      panel: { width: 200, height: 150 },
      viewport,
      placement: 'below',
      align: 'left',
    })
    expect(left).toBe(400)
  })

  it('clamps a left-overflowing panel to the 8px margin', () => {
    const { left } = computeMenuPanelPosition({
      anchor: anchor({ left: 10, right: 40 }),
      panel: { width: 200, height: 150 },
      viewport,
      placement: 'below',
    })
    expect(left).toBe(8)
  })

  it('does not vertically clamp (preserves long-standing behaviour)', () => {
    const { top } = computeMenuPanelPosition({
      anchor: anchor({ bottom: 790 }),
      panel: { width: 200, height: 150 },
      viewport,
      placement: 'below',
    })
    expect(top).toBe(796) // off-screen is acceptable for the short sidebar menus
  })
})

describe('computeMenuPanelPosition — right (ribbon flyout)', () => {
  it('flies out to the right of the icon, top-aligned', () => {
    const { top, left } = computeMenuPanelPosition({
      anchor: anchor({ top: 100, left: 40, right: 80 }),
      panel: { width: 220, height: 200 },
      viewport,
      placement: 'right',
    })
    expect(left).toBe(86) // right (80) + gap (6)
    expect(top).toBe(100)
  })

  it('flips to the left of the icon when the right side would overflow', () => {
    const { left } = computeMenuPanelPosition({
      anchor: anchor({ left: 920, right: 960 }),
      panel: { width: 220, height: 200 },
      viewport,
      placement: 'right',
    })
    expect(left).toBe(694) // left (920) - gap (6) - width (220)
  })

  it('clamps the top so a tall panel stays on screen', () => {
    const { top } = computeMenuPanelPosition({
      anchor: anchor({ top: 700 }),
      panel: { width: 220, height: 200 },
      viewport,
      placement: 'right',
    })
    expect(top).toBe(592) // 800 - 200 - 8
  })
})

describe('computeMenuPanelPosition — no anchor (mobile / command)', () => {
  it('centres the panel horizontally near the top of the viewport', () => {
    const { top, left } = computeMenuPanelPosition({
      anchor: null,
      panel: { width: 300, height: 250 },
      viewport,
      placement: 'right',
    })
    expect(left).toBe(350) // (1000 - 300) / 2
    expect(top).toBe(96) // round(800 * 0.12)
  })

  it('clamps a panel wider than the viewport to the margin', () => {
    const { left } = computeMenuPanelPosition({
      anchor: null,
      panel: { width: 1200, height: 250 },
      viewport: { width: 360, height: 640 },
      placement: 'right',
    })
    expect(left).toBe(8)
  })
})
