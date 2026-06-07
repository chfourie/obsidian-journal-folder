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

// Task migration within a folder, driven through the "Migrate tasks to this
// note…" command + the MigrationTaskPicker modal. Verifies the origin is
// stamped with the migrated status and a forward reference, and the copy lands
// in the destination note. Fixtures: Work/2026-06-05 (source, two open tasks)
// → Work/2026-06-06 (destination).

const SRC = 'Work/2026-06-05.md'
const DEST = 'Work/2026-06-06.md'

async function openPicker(ctx) {
  await ctx.openNote('Work/2026-06-06', 'preview')
  await ctx.eval(
    `app.commands.executeCommandById('journal-folder:migrate-tasks-to-note')`
  )
  await ctx.sleep(700)
}

export const suite = {
  name: 'task-migration',
  description:
    'Task migration moves unfinished tasks forward between journal notes in the same folder. You pick tasks from sibling notes in a picker; the origin is marked as migrated and linked to its new home, and a fresh copy lands in the destination note with a link back.',
  settings: {},
  tests: [
    [
      'the migrate picker lists active tasks from sibling notes',
      async (ctx) => {
        await openPicker(ctx)
        ctx.step('From a destination note, run "Migrate tasks to this note" to open the picker, which groups the still-open tasks from sibling notes ready to pull forward.')
        ctx.assert.ok(await ctx.exists('[data-jf-migrate-picker]'), 'picker modal open')
        ctx.assert.ok(
          await ctx.exists(`[data-jf-migrate-group="${SRC}"]`),
          'source note group listed'
        )
        ctx.assert.ok(
          await ctx.exists(`[data-jf-migrate-task="${SRC}:7"]`),
          'an open task row is offered'
        )
        // Nothing is selected by default — confirm is disabled.
        ctx.assert.eq(
          await ctx.attr('[data-jf-migrate-confirm]', 'disabled'),
          '',
          'confirm disabled until a task is picked'
        )
        await ctx.shot('Migration picker grouping open tasks by note', { rect: "bodyRect('[data-jf-migrate-picker]')" })
        await ctx.click('[data-jf-migrate-cancel]', { settleMs: 200 })
      },
    ],
    [
      'migrating stamps the origin and copies the task to the destination',
      async (ctx) => {
        await openPicker(ctx)
        ctx.step('Tick the task you want and confirm; the origin is stamped as migrated and a copy is written into the note you ran the command from.')
        // Tick a single task (clicking the label toggles its checkbox).
        await ctx.click(`[data-jf-migrate-task="${SRC}:7"]`, { settleMs: 300 })
        await ctx.shot('Task selected, ready to migrate', { rect: "bodyRect('[data-jf-migrate-picker]')" })
        await ctx.click('[data-jf-migrate-confirm]', { settleMs: 800 })
        const stamped = await ctx.waitFor(() => /- \[>\] ship the release notes/.test(ctx.readNote(SRC)))

        const src = ctx.readNote(SRC)
        const dest = ctx.readNote(DEST)
        // Origin line stamped with the Bullet Journal migrated status ('>').
        ctx.assert.ok(stamped, 'origin task stamped as migrated')
        // Destination received a fresh copy of the task body.
        ctx.assert.contains(dest, 'ship the release notes', 'task copied into destination')
        // The other task was NOT migrated (opt-in selection).
        ctx.assert.match(src, /- \[ \] review the pull request/, 'unticked task untouched')
        // Cross-references (enabled in baseline): origin links forward to the
        // destination day, destination links back to the origin day.
        ctx.assert.contains(src, '2026-06-06', 'origin carries a forward reference to the destination')
        ctx.assert.contains(dest, '2026-06-05', 'destination carries a back reference to the origin')
        await ctx.openNote('Work/2026-06-06', 'preview')
        await ctx.shot('Destination note with the migrated task copied in')
      },
    ],
    [
      'cancelling the picker changes nothing',
      async (ctx) => {
        await openPicker(ctx)
        ctx.step('Cancelling the picker leaves every note exactly as it was, so opening it to browse never changes anything.')
        const before = ctx.readNote(SRC)
        await ctx.click('[data-jf-migrate-cancel]', { settleMs: 400 })
        await ctx.sleep(300)
        ctx.assert.eq(ctx.readNote(SRC), before, 'source untouched after cancel')
      },
    ],
  ],
}
