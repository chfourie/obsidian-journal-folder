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
  description:
    'The sidebar task panel gathers tasks from your journal and lets you narrow what it shows along four axes — anchor, time range, folders, and a completed filter. Your choices are remembered, and the quarter range only appears when quarterly notes are enabled.',
  settings: {},
  tests: [
    [
      'scope summary reflects the baseline scope',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.step('Open the sidebar task panel; a one-line summary at the top tells you the current scope at a glance.')
        const summary = await ctx.text(`${PANEL} .journal-folder-tasks-summary`)
        ctx.assert.contains(summary, 'Day', 'baseline range is Day')
        await ctx.shot('Task panel with its scope summary', { rect: "bodyRect('[data-jf-task-list=\"sidebar\"]')" })
        await ctx.closeSidebar()
      },
    ],
    [
      'scope panel opens with all four axes',
      async (ctx) => {
        await openScope(ctx)
        ctx.step('Click Scope to open the panel, which exposes all four axes: anchor, time range, folders, and the completed filter.')
        ctx.assert.ok(await ctx.exists('[data-jf-scope-panel]'), 'panel open')
        for (const axis of ['anchor', 'range', 'folders', 'filter']) {
          ctx.assert.ok(
            await ctx.exists(`[data-jf-scope-section="${axis}"]`),
            `${axis} section present`
          )
        }
        await ctx.shot('Scope panel showing all four axes', { rect: "bodyRect('[data-jf-scope-panel]')" })
        await ctx.closeSidebar()
      },
    ],
    [
      'changing the range persists to settings',
      async (ctx) => {
        await openScope(ctx)
        ctx.step('Pick a wider time range, such as Week, and the panel remembers it across sessions.')
        await ctx.click('[data-jf-scope-option="range:week"]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'tasksSidebarRange') === 'week'),
          'range saved'
        )
        await ctx.shot('Week range selected in the scope panel', { rect: "bodyRect('[data-jf-scope-panel]')" })
        await ctx.closeSidebar()
      },
    ],
    [
      'changing the anchor persists to settings',
      async (ctx) => {
        await openScope(ctx)
        ctx.step('Switch the anchor to the current note so the task list follows whichever journal note you are viewing, and that choice is saved.')
        await ctx.click('[data-jf-scope-option="anchor:note"]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'tasksSidebarAnchor') === 'note'),
          'anchor saved'
        )
        await ctx.shot('Current-note anchor selected', { rect: "bodyRect('[data-jf-scope-panel]')" })
        await ctx.closeSidebar()
      },
    ],
    [
      'selecting all-folders persists to settings',
      async (ctx) => {
        await openScope(ctx)
        ctx.step('Choose All journal folders to pull tasks from every journal at once, and the panel keeps that setting.')
        await ctx.click('[data-jf-scope-option="folder:all"]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'tasksSidebarFolderMode') === 'all'),
          'folder mode saved'
        )
        await ctx.shot('All-folders scope selected', { rect: "bodyRect('[data-jf-scope-panel]')" })
        await ctx.closeSidebar()
      },
    ],
    [
      'toggling show-completed persists to settings',
      async (ctx) => {
        const before = await setting(ctx, 'tasksShowCompleted')
        await openScope(ctx)
        ctx.step('Toggle the completed filter to show or hide finished tasks; the preference is remembered for next time.')
        await ctx.click('[data-jf-scope-option="filter:show-completed"]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'tasksShowCompleted') === !before),
          'show-completed flipped'
        )
        await ctx.shot('Completed-tasks filter toggled', { rect: "bodyRect('[data-jf-scope-panel]')" })
        await ctx.closeSidebar()
      },
    ],
    [
      'the quarter range option is gated by quartersEnabled',
      async (ctx) => {
        await openScope(ctx)
        ctx.step('The Quarter range only shows up once quarterly notes are enabled; with quarters off it is absent, and after turning them on it appears among the range options.')
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
        await ctx.shot('Quarter range option available with quarters enabled', { rect: "bodyRect('[data-jf-scope-panel]')" })
        await ctx.closeSidebar()
      },
    ],
  ],
}
