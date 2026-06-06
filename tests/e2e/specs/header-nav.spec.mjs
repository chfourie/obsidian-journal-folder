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
  settings: {},
  tests: [
    [
      'daily note renders the folder title and H1 title',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.assert.ok(await ctx.exists(`${RV} .journal-folder-header`), 'header present')
        const folderTitle = await ctx.text(`${RV} .journal-folder-header-folder-title`)
        ctx.assert.eq(folderTitle, 'Journal', 'folder title from journal-folder.md')
        const h1 = await ctx.text(`${RV} .journal-folder-header-title`)
        ctx.assert.ok(h1 && h1.length > 0, 'H1 title rendered')
      },
    ],
    [
      'backward navigation link targets the previous day',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        const back = await ctx.attr(`${RV} [data-jf-id="nav-backward"]`, 'href')
        ctx.assert.ok(back, 'backward link present')
        ctx.assert.contains(back, '2026-06-05', 'points at the previous day')
      },
    ],
    [
      'More popover opens and shows a calendar toggle',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        const before = await ctx.attr(`${RV} [data-jf-more-button]`, 'aria-expanded')
        ctx.assert.eq(before, 'false', 'popover starts closed')
        await ctx.click(`${RV} [data-jf-more-button]`)
        ctx.assert.ok(await ctx.exists('[data-jf-more-panel]'), 'panel portaled to body')
        ctx.assert.ok(
          await ctx.exists('[data-jf-more-panel] [data-jf-calendar-toggle]'),
          'calendar toggle present in panel'
        )
        const after = await ctx.attr(`${RV} [data-jf-more-button]`, 'aria-expanded')
        ctx.assert.eq(after, 'true', 'aria-expanded flips on open')
      },
    ],
    [
      'monthly note renders a header too',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06', 'preview')
        ctx.assert.ok(await ctx.exists(`${RV} .journal-folder-header`), 'header on monthly note')
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
      },
    ],
  ],
}
