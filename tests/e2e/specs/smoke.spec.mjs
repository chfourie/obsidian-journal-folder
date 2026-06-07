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

// Smoke suite — proves the end-to-end pipeline works (CLI eval, note opening,
// the plugin's code-block processor, DOM selection) before any feature spec.

export const suite = {
  name: 'smoke',
  description:
    'Baseline checks that the plugin loads and that a journal note renders its header while a non-journal note stays untouched.',
  settings: {},
  tests: [
    [
      'plugin is loaded and exposes settings',
      async (ctx) => {
        const loaded = await ctx.evalJSON(`!!app.plugins.plugins['journal-folder']`)
        ctx.step('Confirm the Journal Folder plugin is installed and active.')
        ctx.assert.ok(loaded, 'journal-folder plugin should be loaded')
      },
    ],
    [
      'daily note renders the journal header',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open a daily note and check the journal header appears.')
        const has = await ctx.exists('.journal-folder-header')
        ctx.assert.ok(has, 'header should render in a journal daily note')
        await ctx.shot('Daily note journal header', {
          rect: "rectOf('.journal-folder-header')",
        })
      },
    ],
    [
      'header is a no-op in a non-journal note',
      async (ctx) => {
        await ctx.openNote('Misc/not-a-journal', 'preview')
        ctx.step('Open an ordinary note and confirm no journal header is added.')
        const has = await ctx.exists(
          '.workspace-leaf.mod-active .journal-folder-header'
        )
        ctx.assert.ok(!has, 'no header in a non-journal note')
      },
    ],
  ],
}
