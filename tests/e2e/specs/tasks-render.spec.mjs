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
  settings: {},
  tests: [
    [
      'in-note journal-tasks block renders task rows',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.assert.ok(await ctx.exists(NOTE_LIST), 'journal-tasks block rendered')
        const rows = await ctx.count(`${NOTE_LIST} [data-jf-task-item]`)
        ctx.assert.ok(rows >= 1, `expected task rows, got ${rows}`)
      },
    ],
    [
      'plugin-rendered status icons are present (Bullet Journal flow)',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        const icons = await ctx.count(`${NOTE_LIST} [data-jf-status-icon]`)
        ctx.assert.ok(icons >= 1, 'status icon shells rendered')
      },
    ],
    [
      'document-body checkboxes get the plugin swap marker',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        // The raw `- [ ]` lines in the note body (not the aggregated block).
        ctx.assert.ok(
          (await ctx.count(`${RV} li.task-list-item[data-jf-doc-line]`)) >= 1,
          'document task lines tagged with their source line'
        )
        ctx.assert.ok(
          (await ctx.count(`${RV} [data-jf-doc-icon]`)) >= 1,
          'custom status icon injected into the document body'
        )
      },
    ],
    [
      'sidebar task panel renders with a scope trigger',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.assert.ok(
          await ctx.exists('[data-jf-task-list="sidebar"]'),
          'sidebar task panel present'
        )
        ctx.assert.ok(
          await ctx.exists('[data-jf-task-list="sidebar"] [data-jf-scope-trigger]'),
          'scope trigger present'
        )
        await ctx.closeSidebar()
      },
    ],
    [
      'tasks are grouped under their source note',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.assert.ok(
          (await ctx.count('[data-jf-task-list="sidebar"] [data-jf-task-group="note"]')) >= 1,
          'at least one note group'
        )
        await ctx.closeSidebar()
      },
    ],
    [
      'tasks matching a category appear in a category section',
      async (ctx) => {
        // Baseline has an "important" category (#important); the day's tasks
        // include one tagged #important.
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.assert.ok(
          await ctx.exists(
            '[data-jf-task-list="sidebar"] [data-jf-task-group="category"][data-jf-group-id="important"]'
          ),
          'Important category section present'
        )
        await ctx.closeSidebar()
      },
    ],
    [
      'the truncation footer appears when the item cap is hit',
      async (ctx) => {
        await ctx.applySettings({ tasksMaxItems: 1 })
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.assert.ok(
          await ctx.exists('[data-jf-task-list="sidebar"] [data-jf-increase-cap]'),
          'truncation footer with increase-limit link'
        )
        await ctx.closeSidebar()
      },
    ],
  ],
}
