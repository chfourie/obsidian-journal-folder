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

// Auto-template seeding: a newly created journal note in a journal folder is
// seeded with the configured template body when enabled, and left empty when
// disabled. New notes are created through the app so the vault 'create'
// listener fires exactly as for a user-created note.

const NEW_DAILY = 'Journal/2026-06-12.md'
const TEMPLATE = '## Daily log\n\n- \n'

export const suite = {
  name: 'auto-template',
  settings: {
    autoTemplateEnabled: true,
    autoTemplatePerTier: false,
    autoTemplateContent: TEMPLATE,
  },
  tests: [
    [
      'a new journal note is seeded with the template body',
      async (ctx) => {
        ctx.assert.ok(!ctx.noteExists(NEW_DAILY), 'precondition: note absent')
        await ctx.createNoteViaApp(NEW_DAILY, '')
        await ctx.sleep(600)
        ctx.assert.contains(
          ctx.readNote(NEW_DAILY),
          '## Daily log',
          'template seeded into the new note'
        )
      },
    ],
    [
      'a non-journal note is not seeded',
      async (ctx) => {
        const path = 'Misc/2026-06-12-scratch.md'
        await ctx.createNoteViaApp(path, '')
        await ctx.sleep(500)
        ctx.assert.ok(
          !ctx.readNote(path).includes('## Daily log'),
          'no template outside a journal folder'
        )
      },
    ],
    [
      'with auto-template disabled the note stays empty',
      async (ctx) => {
        await ctx.applySettings({ autoTemplateEnabled: false })
        await ctx.createNoteViaApp(NEW_DAILY, '')
        await ctx.sleep(500)
        ctx.assert.ok(
          !ctx.readNote(NEW_DAILY).includes('## Daily log'),
          'no seeding when disabled'
        )
      },
    ],
    [
      'per-tier template uses the tier-specific body',
      async (ctx) => {
        await ctx.applySettings({
          autoTemplatePerTier: true,
          dailyNoteAutoTemplateContent: '# Daily tier body\n',
          monthlyNoteAutoTemplateContent: '# Monthly tier body\n',
        })
        await ctx.createNoteViaApp(NEW_DAILY, '')
        await ctx.sleep(600)
        const body = ctx.readNote(NEW_DAILY)
        ctx.assert.contains(body, '# Daily tier body', 'daily tier template used')
        ctx.assert.ok(!body.includes('Monthly tier body'), 'not the monthly tier template')
      },
    ],
  ],
}
