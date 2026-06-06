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

// Sidebar task scope panel: the anchor / range / folders / filter axes, their
// persistence to settings, and the quarters-gated range option.

const PANEL = '[data-jf-task-list="sidebar"]'

// Settings are persisted to the plugin's data.json on save; read them back
// from disk (the plugin keeps them in a private field, not on the instance).
function setting(ctx, key) {
  return ctx.readSettings()[key]
}

async function openScope(ctx) {
  await ctx.openNote('Journal/2026-06-06', 'preview')
  await ctx.openSidebar()
  await ctx.click(`${PANEL} [data-jf-scope-trigger]`, { settleMs: 300 })
}

export const suite = {
  name: 'tasks-scope',
  settings: {},
  tests: [
    [
      'scope summary reflects the baseline scope',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        const summary = await ctx.text(`${PANEL} .journal-folder-tasks-summary`)
        ctx.assert.contains(summary, 'Day', 'baseline range is Day')
        await ctx.closeSidebar()
      },
    ],
    [
      'scope panel opens with all four axes',
      async (ctx) => {
        await openScope(ctx)
        ctx.assert.ok(await ctx.exists('[data-jf-scope-panel]'), 'panel open')
        for (const axis of ['anchor', 'range', 'folders', 'filter']) {
          ctx.assert.ok(
            await ctx.exists(`[data-jf-scope-section="${axis}"]`),
            `${axis} section present`
          )
        }
        await ctx.closeSidebar()
      },
    ],
    [
      'changing the range persists to settings',
      async (ctx) => {
        await openScope(ctx)
        await ctx.click('[data-jf-scope-option="range:week"]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'tasksSidebarRange') === 'week'),
          'range saved'
        )
        await ctx.closeSidebar()
      },
    ],
    [
      'changing the anchor persists to settings',
      async (ctx) => {
        await openScope(ctx)
        await ctx.click('[data-jf-scope-option="anchor:note"]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'tasksSidebarAnchor') === 'note'),
          'anchor saved'
        )
        await ctx.closeSidebar()
      },
    ],
    [
      'selecting all-folders persists to settings',
      async (ctx) => {
        await openScope(ctx)
        await ctx.click('[data-jf-scope-option="folder:all"]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'tasksSidebarFolderMode') === 'all'),
          'folder mode saved'
        )
        await ctx.closeSidebar()
      },
    ],
    [
      'toggling show-completed persists to settings',
      async (ctx) => {
        const before = await setting(ctx, 'tasksShowCompleted')
        await openScope(ctx)
        await ctx.click('[data-jf-scope-option="filter:show-completed"]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'tasksShowCompleted') === !before),
          'show-completed flipped'
        )
        await ctx.closeSidebar()
      },
    ],
    [
      'the quarter range option is gated by quartersEnabled',
      async (ctx) => {
        await openScope(ctx)
        ctx.assert.ok(
          !(await ctx.exists('[data-jf-scope-option="range:quarter"]')),
          'no quarter option with quarters off'
        )
        await ctx.closeSidebar()
        await ctx.applySettings({ quartersEnabled: true })
        await openScope(ctx)
        ctx.assert.ok(
          await ctx.exists('[data-jf-scope-option="range:quarter"]'),
          'quarter option appears with quarters on'
        )
        await ctx.closeSidebar()
      },
    ],
  ],
}
