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

// Task status interaction: left-click cycles to the flow's next status and
// writes it back to disk; right-click opens the in-house status picker, whose
// selection also persists. Uses the Bullet Journal flow (baseline): open (' ')
// → in-progress ('/') → done ('x'); plus cancelled ('-') via the picker.
//
// Journal/2026-06-06 body has the open task on line index 11 ("- [ ] open task one").

const RV = '.workspace-leaf.mod-active .markdown-reading-view'
const OPEN_ICON = `${RV} li[data-jf-doc-line="11"] [data-jf-doc-icon]`

export const suite = {
  name: 'task-status',
  description:
    'Clicking a task’s status icon cycles it through the active flow (open → in-progress → done) and writes the change straight back to the note on disk; right-clicking opens an in-house status picker for jumping to any status, including cancelled. The same works from the sidebar panel.',
  settings: {},
  tests: [
    [
      'left-click cycles open → in-progress and writes to disk',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note Journal/2026-06-06 with its open task on line 11.')
        ctx.assert.contains(ctx.readNote('Journal/2026-06-06.md'), '- [ ] open task one', 'precondition')
        await ctx.click(OPEN_ICON, { settleMs: 600 })
        const ok = await ctx.waitFor(() =>
          ctx.readNote('Journal/2026-06-06.md').includes('- [/] open task one')
        )
        ctx.assert.ok(ok, 'status advanced to in-progress on disk')
        ctx.step('Left-clicking the icon cycles the task to in-progress and saves it to disk.')
        await ctx.shot('Task cycled to in-progress')
      },
    ],
    [
      'right-click opens the status picker',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note and right-click the open task’s status icon.')
        await ctx.dispatch(OPEN_ICON, 'contextmenu', { settleMs: 400 })
        ctx.assert.ok(await ctx.exists('[data-jf-status-picker]'), 'picker portaled open')
        ctx.assert.ok(
          (await ctx.count('[data-jf-status-picker] [data-jf-status-option]')) >= 3,
          'picker lists the flow statuses'
        )
        ctx.step('The status picker opens listing every status in the flow.')
        await ctx.shot('Status picker', { rect: "bodyRect('[data-jf-status-picker]')" })
      },
    ],
    [
      'choosing a status from the picker persists it',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open the daily note and right-click the task to open the status picker.')
        await ctx.dispatch(OPEN_ICON, 'contextmenu', { settleMs: 400 })
        ctx.step('Choose Cancelled from the picker.')
        await ctx.shot('Choosing Cancelled', { rect: "bodyRect('[data-jf-status-picker]')" })
        await ctx.click('[data-jf-status-picker] [data-jf-status-option="cancelled"]', { settleMs: 600 })
        ctx.assert.ok(
          await ctx.waitFor(() =>
            ctx.readNote('Journal/2026-06-06.md').includes('- [-] open task one')
          ),
          'cancelled status written to disk'
        )
        ctx.step('The cancelled status is written back to the note on disk.')
      },
    ],
    [
      'cycling from the sidebar panel also writes to disk',
      async (ctx) => {
        // Anchor on the active note so 2026-06-06's tasks are in scope whatever
        // the wall-clock date is (the baseline anchor is today + range=day).
        await ctx.applySettings({ tasksSidebarAnchor: 'note' })
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.step('Anchor on the active note and open the sidebar task panel.')
        const icon =
          '[data-jf-task-list="sidebar"] [data-jf-task-item][data-jf-task-line="11"] [data-jf-status-icon]'
        ctx.assert.ok(
          await ctx.waitFor(() => ctx.exists(icon)),
          'open task present in sidebar panel'
        )
        ctx.step('Click the open task’s status icon in the sidebar.')
        await ctx.shot('Cycling a task from the sidebar', { rect: "bodyRect('[data-jf-task-list=\"sidebar\"]')" })
        await ctx.click(icon, { settleMs: 600 })
        ctx.assert.ok(
          await ctx.waitFor(() =>
            ctx.readNote('Journal/2026-06-06.md').includes('- [/] open task one')
          ),
          'sidebar cycle advanced the status on disk'
        )
        ctx.step('Cycling from the sidebar advances the status and saves it to disk.')
        await ctx.closeSidebar()
      },
    ],
    [
      'taskClickOpensPicker makes a left-click open the picker instead of cycling',
      async (ctx) => {
        // Global opt-in: with the setting on, opensPickerOnClick returns true
        // for EVERY status, so a left-click surfaces the picker rather than
        // writing a no-op-free cycle. Apply before opening so the freshly
        // rendered note inherits the flag (it is baked into the model id).
        await ctx.applySettings({ taskClickOpensPicker: true })
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Enable “left-click opens the status menu” and open the daily note.')
        ctx.assert.contains(
          ctx.readNote('Journal/2026-06-06.md'),
          '- [ ] open task one',
          'precondition'
        )
        await ctx.click(OPEN_ICON, { settleMs: 500 })
        ctx.assert.ok(
          await ctx.exists('[data-jf-status-picker]'),
          'left-click opened the status picker'
        )
        // The status must be untouched — the click opened the picker, it did
        // not cycle the task.
        ctx.assert.contains(
          ctx.readNote('Journal/2026-06-06.md'),
          '- [ ] open task one',
          'status not cycled by the left-click'
        )
        ctx.step('With the setting on, a left-click opens the picker and leaves the status unchanged.')
        await ctx.shot('Left-click opens the picker', {
          rect: "bodyRect('[data-jf-status-picker]')",
        })
      },
    ],
    [
      'theme-rendering flow keeps the native checkbox (no plugin icon swap)',
      async (ctx) => {
        // Flip the active flow to theme rendering and confirm the document
        // body keeps Obsidian's native checkbox instead of the plugin shell.
        const flows = ctx.readSettings().taskFlows
        const name = ctx.readSettings().defaultTaskFlow
        flows[name] = { ...flows[name], rendering: 'theme' }
        await ctx.applySettings({ taskFlows: flows })
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Switch the active flow to theme rendering and reopen the daily note.')
        ctx.assert.ok(
          (await ctx.count(`${RV} li.task-list-item input.task-list-item-checkbox`)) >= 1,
          'native checkbox present under theme rendering'
        )
        ctx.assert.eq(
          await ctx.count(`${RV} [data-jf-doc-icon]`),
          0,
          'no plugin icon swap under theme rendering'
        )
        ctx.step('Under theme rendering the note keeps Obsidian’s native checkboxes, with no plugin icon swap.')
        await ctx.shot('Native checkboxes under theme rendering')
      },
    ],
  ],
}
