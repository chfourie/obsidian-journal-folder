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

import { moment } from 'obsidian'

// Pure helpers for the calendar's quick-navigation controls (Today button,
// year picker, month picker). Kept separate from `journal-calendar-info.ts`
// so the Svelte component can test offset arithmetic without rebuilding the
// whole `CalendarInfo` shape.

export type AnchorMonth = {
  // Calendar year (Gregorian). The note's `getMoment()` already uses the
  // appropriate year strategy (gggg for weekly, YYYY for everything else),
  // and offset arithmetic is expressed in calendar months either way.
  year: number
  // 0-indexed month (Jan = 0), matching moment's `month()` API.
  month: number
}

// The month at the calendar's anchor index given the note's moment and the
// current `offsetMonths` slider. Mirrors how `buildCalendarInfo` resolves
// `firstMonth = anchor - before + offset`: the anchor itself is always at
// `noteMoment + offsetMonths`.
export function anchorMonth(
  noteMoment: moment.Moment,
  offsetMonths: number
): AnchorMonth {
  const m = noteMoment.clone().startOf('month').add(offsetMonths, 'month')
  return { year: m.year(), month: m.month() }
}

// Inverse of `anchorMonth`: the offset value needed to land the anchor on
// `(targetYear, targetMonth)`. Lets the year/month pickers translate the
// user's selection straight into an `offsetMonths` setter call.
export function offsetForTarget(
  noteMoment: moment.Moment,
  targetYear: number,
  targetMonth: number
): number {
  const note = noteMoment.clone().startOf('month')
  return (
    (targetYear - note.year()) * 12 + (targetMonth - note.month())
  )
}

// 12 month options labelled with the active locale's short month names.
// Routed through Obsidian's bundled moment so the labels match weekday
// headers and the rest of the calendar.
export function monthOptions(): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = []
  for (let i = 0; i < 12; i++) {
    // @ts-ignore — `moment()` returns a Moment from the obsidian-bundled lib.
    out.push({ label: moment().month(i).format('MMM'), value: i })
  }
  return out
}

export function sameAnchor(a: AnchorMonth, b: AnchorMonth): boolean {
  return a.year === b.year && a.month === b.month
}

export function todayAnchor(): AnchorMonth {
  // @ts-ignore — `moment()` returns a Moment from the obsidian-bundled lib.
  const t = moment()
  return { year: t.year(), month: t.month() }
}

// `Current` jumps the calendar so today's month sits at the anchor. Hide
// when the visible anchor is already today's month — the link would be a
// no-op there.
export function shouldShowCurrentLink(
  visible: AnchorMonth,
  today: AnchorMonth
): boolean {
  return !sameAnchor(visible, today)
}

// `Note month` jumps the calendar to the (active or hosting) note's
// month. Hide when:
//   - there isn't a note month (e.g. no active journal note in the
//     sidebar context), or
//   - the note's month is already the visible anchor (same no-op case),
//     or
//   - the note's month coincides with today's month — in that case the
//     `Current` link covers the same target and showing both would just
//     be redundant chrome.
export function shouldShowNoteMonthLink(
  visible: AnchorMonth,
  noteMonth: AnchorMonth | null,
  today: AnchorMonth
): boolean {
  if (!noteMonth) return false
  if (sameAnchor(noteMonth, today)) return false
  return !sameAnchor(visible, noteMonth)
}
