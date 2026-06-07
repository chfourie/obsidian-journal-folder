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

// In-note calendar: rendering, day-cell state classes, the Year/Month picker,
// and the create-missing-note confirmation flow (a past, empty day cell).
// Calendar visibility defaults on (defaultCalendarVisibleDesktop = true).

const RV = '.workspace-leaf.mod-active .markdown-reading-view'
const CAL = `${RV} .journal-folder-calendar`

export const suite = {
  name: 'calendar',
  description:
    'The in-note calendar shows the current month as a grid of day cells, marks which days already have notes, lets you jump around with arrows and a Year/Month picker, and creates a missing entry when you click an empty day.',
  settings: {},
  tests: [
    [
      'calendar renders day cells and a weekday header',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note Journal/2026-06-06 in reading view.')
        ctx.assert.ok(await ctx.exists(CAL), 'calendar visible by default')
        const days = await ctx.count(`${CAL} [data-jf-cell="day"]`)
        ctx.assert.ok(days >= 28, `expected a month of day cells, got ${days}`)
        ctx.step(`The calendar shows the month grid with ${days} day cells.`)
        await ctx.shot('Month calendar', { rect: "rectOf('.journal-folder-calendar')" })
      },
    ],
    [
      'an existing day cell is marked exists; a missing one is marked missing',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note Journal/2026-06-06 in reading view.')
        const existsCls = await ctx.attr(`${CAL} [data-jf-cell="day"][data-jf-date="2026-06-06"]`, 'class')
        ctx.assert.contains(existsCls, 'exists', 'today (has a note) is marked exists')
        const missCls = await ctx.attr(`${CAL} [data-jf-cell="day"][data-jf-date="2026-06-04"]`, 'class')
        ctx.assert.contains(missCls, 'missing', 'an empty day is marked missing')
        ctx.step('Days with a note are styled as existing; empty days are styled as missing.')
        await ctx.shot('Existing vs missing day cells', { rect: "rectOf('.journal-folder-calendar')" })
      },
    ],
    [
      'Year/Month picker opens with a month grid',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note and click the Year/Month picker trigger.')
        await ctx.click(`${CAL} [data-jf-picker-trigger]`)
        ctx.assert.ok(await ctx.exists('[data-jf-date-picker]'), 'picker portaled open')
        const months = await ctx.count('[data-jf-date-picker] [data-jf-month-select]')
        ctx.assert.eq(months, 12, 'twelve month options')
        ctx.step('The picker opens with a year selector and twelve month options.')
        await ctx.shot('Year/Month picker', { rect: "bodyRect('[data-jf-date-picker]')" })
      },
    ],
    [
      'clicking a past empty day cell creates the note after confirmation',
      async (ctx) => {
        ctx.assert.ok(!ctx.noteExists('Journal/2026-06-04.md'), 'precondition: note absent')
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Click the past, empty day cell for 2026-06-04.')
        await ctx.click(`${CAL} [data-jf-cell="day"][data-jf-date="2026-06-04"]`, { settleMs: 500 })
        ctx.step('A confirmation modal asks before creating the missing note.')
        await ctx.shot('Create-missing-note confirmation', { rect: "bodyRect('.modal-container .modal')" })
        // Native confirm modal — click its "Create" CTA.
        const clicked = await ctx.click('.modal-container .modal-button-container button.mod-cta', {
          settleMs: 800,
        })
        ctx.assert.ok(clicked, 'confirm modal CTA was present')
        const created = await ctx.waitFor(() => ctx.noteExists('Journal/2026-06-04.md'))
        ctx.assert.ok(created, 'note created on disk')
        ctx.step('Confirming creates the note Journal/2026-06-04 on disk.')
      },
    ],
    [
      'prev / next arrows change the visible months',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note, then click the next arrow to advance a month.')
        // June is shown; next should bring July (2026-07-01) into view.
        await ctx.click(`${CAL} [data-jf-nav="next"]`, { settleMs: 400 })
        ctx.assert.ok(
          await ctx.exists(`${CAL} [data-jf-cell="day"][data-jf-date="2026-07-01"]`),
          'next month scrolled into view'
        )
        ctx.step('The next arrow scrolls July into view.')
        await ctx.shot('Next month in view', { rect: "rectOf('.journal-folder-calendar')" })
        // Two prev steps from there reaches May.
        await ctx.click(`${CAL} [data-jf-nav="prev"]`, { settleMs: 300 })
        await ctx.click(`${CAL} [data-jf-nav="prev"]`, { settleMs: 400 })
        ctx.assert.ok(
          await ctx.exists(`${CAL} [data-jf-cell="day"][data-jf-date="2026-05-01"]`),
          'prev months scrolled into view'
        )
        ctx.step('Two clicks of the prev arrow scroll back to May.')
      },
    ],
    [
      'the Current link jumps back to today’s month',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note and scroll two months ahead so the Current link appears.')
        // Scroll away so the Current control appears, then use it.
        await ctx.click(`${CAL} [data-jf-nav="next"]`, { settleMs: 300 })
        await ctx.click(`${CAL} [data-jf-nav="next"]`, { settleMs: 400 })
        ctx.assert.ok(await ctx.exists(`${CAL} [data-jf-quick-jump="today"]`), 'Current link shown')
        await ctx.click(`${CAL} [data-jf-quick-jump="today"]`, { settleMs: 400 })
        ctx.assert.ok(
          await ctx.exists(`${CAL} [data-jf-cell="day"][data-jf-date="2026-06-06"]`),
          'jumped back to the current month'
        )
        ctx.step('Clicking Current jumps the calendar back to today’s month.')
        await ctx.shot('Back to current month', { rect: "rectOf('.journal-folder-calendar')" })
      },
    ],
    [
      'quarter cell appears only when quarters are enabled',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('With quarters off (baseline), the calendar shows no quarter cell.')
        ctx.assert.eq(
          await ctx.count(`${CAL} [data-jf-cell="quarter"]`),
          0,
          'no quarter cell with quarters off (baseline)'
        )
        await ctx.applySettings({ quartersEnabled: true })
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.assert.ok(
          (await ctx.count(`${CAL} [data-jf-cell="quarter"]`)) >= 1,
          'quarter cell appears with quarters on'
        )
        ctx.step('Enabling quarters adds a quarter cell to the calendar.')
        await ctx.shot('Calendar with quarters enabled', { rect: "rectOf('.journal-folder-calendar')" })
      },
    ],
  ],
}
