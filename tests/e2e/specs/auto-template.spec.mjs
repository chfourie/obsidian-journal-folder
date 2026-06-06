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
// seeded from a **template note** (standardized filename) when enabled, with
// the documented precedence (per-folder override → global tier file → global
// default), and left empty when disabled. New notes are created through the
// app so the vault 'create' listener fires exactly as for a user note.

const GLOBAL_DIR = 'Templates/journal-folder'

// Creates every missing folder segment in the live vault.
async function ensureFolder(ctx, path) {
  await ctx.eval(
    `(async()=>{const parts=${JSON.stringify(path)}.split('/'); let cur=''; ` +
      `for(const p of parts){cur=cur?cur+'/'+p:p; ` +
      `if(!app.vault.getAbstractFileByPath(cur)){try{await app.vault.createFolder(cur)}catch(e){}}} ` +
      `return 'ok'})()`
  )
}

async function writeTemplate(ctx, relPath, content) {
  await ensureFolder(ctx, relPath.slice(0, relPath.lastIndexOf('/')))
  await ctx.createNoteViaApp(relPath, content)
}

export const suite = {
  name: 'auto-template',
  settings: {
    autoTemplateEnabled: true,
    templateFolder: GLOBAL_DIR,
    templateOverrideFolderName: 'Templates',
    // Skip the legacy-inline migration during the suite — there's nothing to
    // migrate and we don't want its one-time write racing the tests.
    templatesMigratedToFiles: true,
  },
  tests: [
    [
      'a new journal note is seeded from the matching tier template file',
      async (ctx) => {
        await writeTemplate(ctx, `${GLOBAL_DIR}/daily-template.md`, '## Daily log\n\n- \n')
        const path = 'Journal/2026-06-12.md'
        ctx.assert.ok(!ctx.noteExists(path), 'precondition: note absent')
        await ctx.createNoteViaApp(path, '')
        await ctx.sleep(600)
        ctx.assert.contains(
          ctx.readNote(path),
          '## Daily log',
          'tier template seeded into the new note'
        )
      },
    ],
    [
      'a tier with no dedicated file falls back to default-template.md',
      async (ctx) => {
        await writeTemplate(ctx, `${GLOBAL_DIR}/default-template.md`, '# Fallback body\n')
        const path = 'Journal/2026-W24.md'
        await ctx.createNoteViaApp(path, '')
        await ctx.sleep(600)
        ctx.assert.contains(
          ctx.readNote(path),
          '# Fallback body',
          'default-template used when the weekly file is absent'
        )
      },
    ],
    [
      'a per-folder override file beats the global template file',
      async (ctx) => {
        await writeTemplate(ctx, `${GLOBAL_DIR}/monthly-template.md`, '# Global monthly\n')
        await writeTemplate(ctx, 'Journal/Templates/monthly-template.md', '# Override monthly\n')
        const path = 'Journal/2026-07.md'
        await ctx.createNoteViaApp(path, '')
        await ctx.sleep(600)
        const body = ctx.readNote(path)
        ctx.assert.contains(body, '# Override monthly', 'override template wins')
        ctx.assert.ok(!body.includes('Global monthly'), 'global template not used')
      },
    ],
    [
      'a template file keeps its front matter verbatim',
      async (ctx) => {
        await writeTemplate(
          ctx,
          `${GLOBAL_DIR}/daily-template.md`,
          '---\ntags: [journal]\n---\n# Daily\n'
        )
        const path = 'Journal/2026-06-13.md'
        await ctx.createNoteViaApp(path, '')
        await ctx.sleep(600)
        const body = ctx.readNote(path)
        ctx.assert.contains(body, 'tags: [journal]', 'front matter preserved')
      },
    ],
    [
      'a non-journal note is not seeded',
      async (ctx) => {
        await writeTemplate(ctx, `${GLOBAL_DIR}/daily-template.md`, '## Daily log\n')
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
        await writeTemplate(ctx, `${GLOBAL_DIR}/daily-template.md`, '## Daily log\n')
        await ctx.applySettings({ autoTemplateEnabled: false })
        const path = 'Journal/2026-06-12.md'
        await ctx.createNoteViaApp(path, '')
        await ctx.sleep(500)
        ctx.assert.ok(
          !ctx.readNote(path).includes('## Daily log'),
          'no seeding when disabled'
        )
      },
    ],
  ],
}
