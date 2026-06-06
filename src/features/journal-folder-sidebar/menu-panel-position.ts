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

// Pure positioning for the `<body>`-portaled menu panels (the sidebar More…
// menu and the master ribbon menu). Kept free of DOM access so it can be unit
// tested; callers measure the trigger rect + panel size and feed them in.
//
//   'below'  — drop under the trigger, left/right aligned (the sidebar menus).
//   'right'  — fly out to the right of the trigger (the ribbon icon sits on the
//              far-left dock); flips to the left side if it would overflow.
//   no anchor — centre the panel near the top of the viewport. This is the
//              mobile/command path, where the desktop ribbon strip — and thus
//              any anchor element — does not exist.

export type AnchorRect = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
}

export type PanelSize = { width: number; height: number }
export type Viewport = { width: number; height: number }
export type MenuPlacement = 'below' | 'right'
export type MenuPanelPosition = { top: number; left: number }

// Keep the panel at least this far from every viewport edge.
const MARGIN = 8

export function computeMenuPanelPosition(opts: {
  anchor: AnchorRect | null
  panel: PanelSize
  viewport: Viewport
  placement: MenuPlacement
  align?: 'left' | 'right'
  gap?: number
}): MenuPanelPosition {
  const { anchor, panel, viewport, placement, align = 'right', gap = 6 } = opts
  if (!anchor) return centered(panel, viewport)
  if (placement === 'right') return flyoutRight(anchor, panel, viewport, gap)
  return below(anchor, panel, viewport, align, gap)
}

function below(
  anchor: AnchorRect,
  panel: PanelSize,
  viewport: Viewport,
  align: 'left' | 'right',
  gap: number
): MenuPanelPosition {
  const left = align === 'left' ? anchor.left : anchor.right - panel.width
  // Drop below with no vertical clamp — matches the long-standing sidebar
  // behaviour; the sidebar menus are short and anchored near the top.
  return { top: anchor.bottom + gap, left: clampLeft(left, panel.width, viewport) }
}

function flyoutRight(
  anchor: AnchorRect,
  panel: PanelSize,
  viewport: Viewport,
  gap: number
): MenuPanelPosition {
  let left = anchor.right + gap
  if (left + panel.width > viewport.width - MARGIN) {
    // Would overflow the right edge: try the left side of the icon, else clamp.
    const flipped = anchor.left - gap - panel.width
    left = flipped >= MARGIN ? flipped : clampLeft(left, panel.width, viewport)
  }
  return { top: clampTop(anchor.top, panel.height, viewport), left }
}

function centered(panel: PanelSize, viewport: Viewport): MenuPanelPosition {
  const left = clampLeft(
    Math.round((viewport.width - panel.width) / 2),
    panel.width,
    viewport
  )
  const top = clampTop(
    Math.round(viewport.height * 0.12),
    panel.height,
    viewport
  )
  return { top, left }
}

function clampLeft(left: number, width: number, viewport: Viewport): number {
  if (left < MARGIN) return MARGIN
  if (left + width > viewport.width - MARGIN) {
    return Math.max(MARGIN, viewport.width - width - MARGIN)
  }
  return left
}

function clampTop(top: number, height: number, viewport: Viewport): number {
  if (top < MARGIN) return MARGIN
  if (top + height > viewport.height - MARGIN) {
    return Math.max(MARGIN, viewport.height - height - MARGIN)
  }
  return top
}
