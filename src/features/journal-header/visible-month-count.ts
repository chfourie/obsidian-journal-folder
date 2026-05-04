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

// Picks how many month panels fit in `measuredWidth`, after subtracting room
// for the two arrow buttons. Mobile uses a larger per-month minimum so the
// enlarged tap-target cells have room to breathe — desktop keeps the tighter
// spacing the user explicitly preferred. The per-month constants include the
// inter-month gap so `floor(available / minMonthPx)` slightly over-counts the
// space each month needs and never returns a count whose grids would overflow
// their containers (with cells now fixed-width, an under-count would let
// adjacent months visually overlap).

export const MAX_MONTHS = 5
export const ARROW_PX = 28
export const DESKTOP_MIN_MONTH_PX = 220
export const MOBILE_MIN_MONTH_PX = 340

export type VisibleMonthCountOpts = {
  isMobile: boolean
}

export function pickVisibleMonthCount(
  measuredWidth: number,
  { isMobile }: VisibleMonthCountOpts
): number {
  if (measuredWidth <= 0) return 1
  const available = Math.max(0, measuredWidth - ARROW_PX * 2)
  const minMonthPx = isMobile ? MOBILE_MIN_MONTH_PX : DESKTOP_MIN_MONTH_PX
  const fits = Math.floor(available / minMonthPx)
  return Math.max(1, Math.min(MAX_MONTHS, fits))
}
