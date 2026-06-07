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

// journal-header in-note block: title, prev/today/forward navigation links,
// and the More popover. Scoped to the active reading view so the hidden
// live-preview header copy doesn't interfere.

const RV = '.workspace-leaf.mod-active .markdown-reading-view'

export const suite = {
  name: 'header-nav',
  description:
    'The in-note journal header rendered by the `journal-header` code block — ' +
    'the folder title, the entry’s H1, the back / Today / forward navigation row, ' +
    'and the “More…” popover that hosts the calendar toggle and secondary links.',
  settings: {},
  tests: [
    [
      'daily note renders the folder title and H1 title',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note Journal/2026-06-06 in reading view.')
        ctx.assert.ok(await ctx.exists(`${RV} .journal-folder-header`), 'header present')
        const folderTitle = await ctx.text(`${RV} .journal-folder-header-folder-title`)
        ctx.assert.eq(folderTitle, 'Journal', 'folder title from journal-folder.md')
        const h1 = await ctx.text(`${RV} .journal-folder-header-title`)
        ctx.assert.ok(h1 && h1.length > 0, 'H1 title rendered')
        ctx.step(`Header shows the folder title “${folderTitle}” and the entry’s H1.`)
        await ctx.shot('Daily note header', { rect: "rectOf('.journal-folder-header')" })
      },
    ],
    [
      'backward navigation link targets the previous day',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        const back = await ctx.attr(`${RV} [data-jf-id="nav-backward"]`, 'href')
        ctx.assert.ok(back, 'backward link present')
        ctx.assert.contains(back, '2026-06-05', 'points at the previous day')
        ctx.step('The ‹‹ back link on 2026-06-06 resolves to the previous day, 2026-06-05.')
        await ctx.shot('Navigation row (back / Today / forward)', {
          rect: "rectOf('.journal-folder-header')",
        })
      },
    ],
    [
      'More popover opens and shows a calendar toggle',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        const before = await ctx.attr(`${RV} [data-jf-more-button]`, 'aria-expanded')
        ctx.assert.eq(before, 'false', 'popover starts closed')
        await ctx.click(`${RV} [data-jf-more-button]`)
        ctx.step('Click “More…” to open the secondary popover (portaled to <body>).')
        ctx.assert.ok(await ctx.exists('[data-jf-more-panel]'), 'panel portaled to body')
        ctx.assert.ok(
          await ctx.exists('[data-jf-more-panel] [data-jf-calendar-toggle]'),
          'calendar toggle present in panel'
        )
        const after = await ctx.attr(`${RV} [data-jf-more-button]`, 'aria-expanded')
        ctx.assert.eq(after, 'true', 'aria-expanded flips on open')
        await ctx.shot('“More…” popover with the calendar toggle', {
          rect: "bodyRect('[data-jf-more-panel]')",
        })
      },
    ],
    [
      'monthly note renders a header too',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06', 'preview')
        ctx.step('Open the monthly note Journal/2026-06 — the header adapts to the month tier.')
        ctx.assert.ok(await ctx.exists(`${RV} .journal-folder-header`), 'header on monthly note')
        await ctx.shot('Monthly note header', { rect: "rectOf('.journal-folder-header')" })
      },
    ],
    [
      'a past note links forward to the next day',
      async (ctx) => {
        // Today is 2026-06-06, so 2026-06-05 is the previous day and its
        // header offers forward navigation toward today.
        await ctx.openNote('Journal/2026-06-05', 'preview')
        const fwd = await ctx.attr(`${RV} [data-jf-id="nav-forward"]`, 'href')
        ctx.assert.contains(fwd, '2026-06-06', 'forward link points at the next day')
        ctx.step('On the past note 2026-06-05 the ›› forward link points at the next day.')
        await ctx.shot('Forward navigation on a past note', {
          rect: "rectOf('.journal-folder-header')",
        })
      },
    ],
  ],
}
