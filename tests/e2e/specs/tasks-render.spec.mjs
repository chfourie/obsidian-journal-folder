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

// Task rendering across the two surfaces: the in-note `journal-tasks` block and
// the sidebar task panel. Covers task-row rendering, plugin-mode status icons,
// and the document-body checkbox swap.

const RV = '.workspace-leaf.mod-active .markdown-reading-view'
const NOTE_LIST = `${RV} [data-jf-task-list="note"]`

export const suite = {
  name: 'tasks-render',
  description:
    'Tasks appear in two places: an in-note journal-tasks block that aggregates tasks for the note’s period, and a sidebar task panel. Both render custom status icons, group tasks by source note and category, and show a truncation footer when the item limit is reached.',
  settings: {},
  tests: [
    [
      'in-note journal-tasks block renders task rows',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note Journal/2026-06-06 in reading view.')
        ctx.assert.ok(await ctx.exists(NOTE_LIST), 'journal-tasks block rendered')
        const rows = await ctx.count(`${NOTE_LIST} [data-jf-task-item]`)
        ctx.assert.ok(rows >= 1, `expected task rows, got ${rows}`)
        ctx.step(`The in-note journal-tasks block lists ${rows} task rows.`)
        await ctx.shot('In-note task block', { rect: "rectOf('[data-jf-task-list=\"note\"]')" })
      },
    ],
    [
      'plugin-rendered status icons are present (Bullet Journal flow)',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note in reading view.')
        const icons = await ctx.count(`${NOTE_LIST} [data-jf-status-icon]`)
        ctx.assert.ok(icons >= 1, 'status icon shells rendered')
        ctx.step('Each task row shows a custom Bullet Journal status icon.')
        await ctx.shot('Bullet Journal status icons', { rect: "rectOf('[data-jf-task-list=\"note\"]')" })
      },
    ],
    [
      'document-body checkboxes get the plugin swap marker',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note and inspect the raw task lines in the note body.')
        // The raw `- [ ]` lines in the note body (not the aggregated block).
        ctx.assert.ok(
          (await ctx.count(`${RV} li.task-list-item[data-jf-doc-line]`)) >= 1,
          'document task lines tagged with their source line'
        )
        ctx.assert.ok(
          (await ctx.count(`${RV} [data-jf-doc-icon]`)) >= 1,
          'custom status icon injected into the document body'
        )
        ctx.step('Native checkboxes in the note body are swapped for the plugin’s status icons.')
        await ctx.shot('Document body status icons')
      },
    ],
    [
      'sidebar task panel renders with a scope trigger',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.step('Open the daily note and reveal the sidebar task panel.')
        ctx.assert.ok(
          await ctx.exists('[data-jf-task-list="sidebar"]'),
          'sidebar task panel present'
        )
        ctx.assert.ok(
          await ctx.exists('[data-jf-task-list="sidebar"] [data-jf-scope-trigger]'),
          'scope trigger present'
        )
        ctx.step('The sidebar panel lists tasks with a Scope opener for narrowing the view.')
        await ctx.shot('Sidebar task panel', { rect: "bodyRect('[data-jf-task-list=\"sidebar\"]')" })
        await ctx.closeSidebar()
      },
    ],
    [
      'tasks are grouped under their source note',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.step('Open the daily note and reveal the sidebar task panel.')
        ctx.assert.ok(
          (await ctx.count('[data-jf-task-list="sidebar"] [data-jf-task-group="note"]')) >= 1,
          'at least one note group'
        )
        ctx.step('Tasks in the sidebar are grouped under the note they came from.')
        await ctx.shot('Tasks grouped by source note', { rect: "bodyRect('[data-jf-task-list=\"sidebar\"]')" })
        await ctx.closeSidebar()
      },
    ],
    [
      'tasks matching a category appear in a category section',
      async (ctx) => {
        // Baseline has an "important" category (#important); 2026-06-06's tasks
        // include one tagged #important. Anchor the panel on the active *note*
        // (not wall-clock today, which is range=day in the baseline) so the
        // fixture's tasks are in scope regardless of the date the suite runs.
        await ctx.applySettings({ tasksSidebarAnchor: 'note' })
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.step('Anchor the panel on the active note and open the sidebar task panel.')
        ctx.assert.ok(
          await ctx.waitFor(() =>
            ctx.exists(
              '[data-jf-task-list="sidebar"] [data-jf-task-group="category"][data-jf-group-id="important"]'
            )
          ),
          'Important category section present'
        )
        ctx.step('A task tagged #important surfaces under its Important category section.')
        await ctx.shot('Important category section', { rect: "bodyRect('[data-jf-task-list=\"sidebar\"]')" })
        await ctx.closeSidebar()
      },
    ],
    [
      'the truncation footer appears when the item cap is hit',
      async (ctx) => {
        // Note-anchored so 2026-06-06's four tasks (> the cap of 1) are in
        // scope independent of the real date.
        await ctx.applySettings({ tasksMaxItems: 1, tasksSidebarAnchor: 'note' })
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.step('Set the item limit to 1 and open the sidebar task panel on the note.')
        ctx.assert.ok(
          await ctx.waitFor(() =>
            ctx.exists('[data-jf-task-list="sidebar"] [data-jf-increase-cap]')
          ),
          'truncation footer with increase-limit link'
        )
        ctx.step('When the cap is exceeded, a truncation footer offers to raise the limit.')
        await ctx.shot('Truncation footer', { rect: "bodyRect('[data-jf-task-list=\"sidebar\"]')" })
        await ctx.closeSidebar()
      },
    ],
  ],
}
