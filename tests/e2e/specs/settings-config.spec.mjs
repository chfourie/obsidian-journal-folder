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

// Editing configuration THROUGH the settings-tab UI and verifying it persists
// to data.json: a dropdown, a text field, a toggle, signifier/category CRUD
// (incl. the 3.0.1 stale-snapshot regression guard), and the task-flow
// drill-down + breadcrumb navigation.

function setting(ctx, key) {
  return ctx.readSettings()[key]
}

export const suite = {
  name: 'settings-config',
  settings: {},
  after: async (ctx) => ctx.closeSettings(),
  tests: [
    [
      'start-of-week dropdown persists',
      async (ctx) => {
        await ctx.openSettings('general')
        await ctx.setValue('[data-jf-setting="startOfWeek"] select', 'monday')
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'startOfWeek') === 'monday'),
          'startOfWeek saved'
        )
        await ctx.closeSettings()
      },
    ],
    [
      'a text field persists',
      async (ctx) => {
        await ctx.openSettings('general')
        await ctx.setValue('[data-jf-setting="journalFolderTitle"] input', 'My Journal')
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'journalFolderTitle') === 'My Journal'),
          'journalFolderTitle saved'
        )
        await ctx.closeSettings()
      },
    ],
    [
      'a toggle persists',
      async (ctx) => {
        await ctx.openSettings('general')
        ctx.assert.eq(setting(ctx, 'quartersEnabled'), false, 'precondition: off')
        await ctx.click('[data-jf-setting="quartersEnabled"] .checkbox-container', { settleMs: 300 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'quartersEnabled') === true),
          'quartersEnabled toggled on'
        )
        await ctx.closeSettings()
      },
    ],
    [
      'a note-title pattern persists (Patterns tab)',
      async (ctx) => {
        await ctx.openSettings('patterns')
        await ctx.setValue('[data-jf-setting="dailyNoteShortTitlePattern"] input', '[D]D')
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'dailyNoteShortTitlePattern') === '[D]D'),
          'dailyNoteShortTitlePattern saved'
        )
        await ctx.closeSettings()
      },
    ],
    [
      'adding a signifier persists and opens its editor',
      async (ctx) => {
        const before = setting(ctx, 'signifiers').length
        await ctx.openSettings('signifiers')
        await ctx.click('[data-jf-add-signifier]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'signifiers').length === before + 1),
          'signifier appended to settings'
        )
        ctx.assert.ok(await ctx.exists('[data-jf-editor-save]'), 'edit modal opened')
        await ctx.click('[data-jf-editor-cancel]', { settleMs: 300 })
        await ctx.closeSettings()
      },
    ],
    [
      'adding then SAVING the editor keeps the list intact (3.0.1 regression)',
      async (ctx) => {
        const baselineIds = setting(ctx, 'signifiers').map((s) => s.id)
        await ctx.openSettings('signifiers')
        await ctx.click('[data-jf-add-signifier]', { settleMs: 400 })
        await ctx.click('[data-jf-editor-save]', { settleMs: 500 })
        const after = await ctx.waitFor(() => setting(ctx, 'signifiers').length === baselineIds.length + 1)
        ctx.assert.ok(after, 'list grew by one (not erased by a stale snapshot)')
        const ids = setting(ctx, 'signifiers').map((s) => s.id)
        for (const id of baselineIds) {
          ctx.assert.ok(ids.includes(id), `pre-existing signifier "${id}" survived the save`)
        }
        await ctx.closeSettings()
      },
    ],
    [
      'removing a signifier persists',
      async (ctx) => {
        const before = setting(ctx, 'signifiers').length
        await ctx.openSettings('signifiers')
        await ctx.click(
          '[data-jf-tab-panel="signifiers"] .jf-signifier-list .setting-item [aria-label="Remove"]',
          { settleMs: 400 }
        )
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'signifiers').length === before - 1),
          'signifier removed from settings'
        )
        await ctx.closeSettings()
      },
    ],
    [
      'adding and removing a category persists (Tasks tab)',
      async (ctx) => {
        const before = setting(ctx, 'taskCategories').length
        await ctx.openSettings('tasks')
        await ctx.click('[data-jf-add-category]', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'taskCategories').length === before + 1),
          'category appended'
        )
        await ctx.click('[data-jf-editor-cancel]', { settleMs: 300 })
        await ctx.click(
          '[data-jf-tab-panel="tasks"] .jf-signifier-list .setting-item:last-child [aria-label="Remove"]',
          { settleMs: 400 }
        )
        ctx.assert.ok(
          await ctx.waitFor(() => setting(ctx, 'taskCategories').length === before),
          'category removed'
        )
        await ctx.closeSettings()
      },
    ],
    [
      'task-flow drill-down and breadcrumb navigate',
      async (ctx) => {
        await ctx.openSettings('tasks')
        ctx.assert.ok(
          await ctx.exists('.jf-flow-row[data-jf-flow="Bullet Journal"]'),
          'flow row present in overview'
        )
        await ctx.click('.jf-flow-row[data-jf-flow="Bullet Journal"]', { settleMs: 400 })
        ctx.assert.ok(await ctx.exists('.jf-breadcrumb'), 'breadcrumb shown in flow detail')
        ctx.assert.contains(
          await ctx.text('[data-jf-tab-panel="tasks"]'),
          'Flow: Bullet Journal',
          'flow detail heading'
        )
        await ctx.click('.jf-breadcrumb-link', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.exists('.jf-flow-row[data-jf-flow="Bullet Journal"]'),
          'back at the overview (flow rows visible again)'
        )
        await ctx.closeSettings()
      },
    ],
  ],
}
