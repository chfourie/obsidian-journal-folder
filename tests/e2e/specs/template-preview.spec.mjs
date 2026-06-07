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

// Template-note preview: a standardized template note containing a
// journal-header block renders as the current-period entry, marked with a
// corner TEMPLATE ribbon, and all of its navigation links are display-only —
// they point at the template file itself rather than at real journal notes.

const RV = '.workspace-leaf.mod-active .markdown-reading-view'
const GLOBAL_DIR = 'Templates/journal-folder'
const MONTHLY = `${GLOBAL_DIR}/monthly-template`
const HEADER_BODY = '```journal-header\n```\n'

async function ensureFolder(ctx, path) {
  await ctx.eval(
    `(async()=>{const parts=${JSON.stringify(path)}.split('/'); let cur=''; ` +
      `for(const p of parts){cur=cur?cur+'/'+p:p; ` +
      `if(!app.vault.getAbstractFileByPath(cur)){try{await app.vault.createFolder(cur)}catch(e){}}} ` +
      `return 'ok'})()`
  )
}

export const suite = {
  name: 'template-preview',
  description:
    'A standardized template note previews as the current-period entry: it shows a corner TEMPLATE ribbon and its header chips and calendar cells are display-only, pointing back at the template file rather than at real journal notes.',
  settings: {
    autoTemplateEnabled: true,
    templateFolder: GLOBAL_DIR,
    templateOverrideFolderName: 'Templates',
    templatesMigratedToFiles: true,
    defaultCalendarVisibleDesktop: true,
  },
  before: async (ctx) => {
    await ensureFolder(ctx, GLOBAL_DIR)
    await ctx.createNoteViaApp(`${MONTHLY}.md`, HEADER_BODY)
  },
  tests: [
    [
      'a template note renders the header with a TEMPLATE ribbon',
      async (ctx) => {
        await ctx.openNote(MONTHLY, 'preview')
        ctx.step('Open the monthly template note and confirm it previews as a live entry with a TEMPLATE ribbon.')
        ctx.assert.ok(
          await ctx.exists(`${RV} .journal-folder-header`),
          'header renders in the template note'
        )
        ctx.assert.ok(
          await ctx.exists(`${RV} [data-jf-template-ribbon]`),
          'TEMPLATE ribbon present'
        )
        const ribbon = await ctx.text(`${RV} [data-jf-template-ribbon]`)
        ctx.assert.eq(ribbon.trim(), 'TEMPLATE', 'ribbon reads TEMPLATE')
        await ctx.shot('Template note preview with TEMPLATE ribbon', {
          rect: "rectOf('.journal-folder-header')",
        })
      },
    ],
    [
      'navigation chips are display-only — they link to the template itself',
      async (ctx) => {
        // The template previews as the *current* month, so its forward chip
        // (next month) is always present; the backward chip is folded out when
        // the previous month is past+missing, so assert on forward.
        await ctx.openNote(MONTHLY, 'preview')
        ctx.step('Confirm the header navigation chips link to the template file instead of real month notes.')
        const fwd = await ctx.attr(`${RV} [data-jf-id="nav-forward"]`, 'href')
        ctx.assert.ok(fwd, 'forward chip present')
        ctx.assert.contains(
          fwd,
          'monthly-template',
          'forward chip points at the template file'
        )
        ctx.assert.ok(
          !/\d{4}-\d{2}/.test(fwd),
          'forward chip does NOT point at a real month note'
        )
      },
    ],
    [
      'calendar cells are display-only but still report their real date',
      async (ctx) => {
        await ctx.openNote(MONTHLY, 'preview')
        ctx.step('Confirm the preview calendar cells are display-only but still carry their real dates.')
        ctx.assert.ok(
          await ctx.exists(`${RV} .journal-folder-calendar`),
          'calendar renders in the preview'
        )
        await ctx.shot('Template preview calendar', {
          rect: "rectOf('.journal-folder-calendar')",
        })
        const href = await ctx.attr(`${RV} [data-jf-cell="day"]`, 'href')
        ctx.assert.contains(
          href,
          'monthly-template',
          'day cell links to the template file, not a daily note'
        )
        const date = await ctx.attr(`${RV} [data-jf-cell="day"]`, 'data-jf-date')
        ctx.assert.ok(
          /\d{4}-\d{2}-\d{2}/.test(date),
          'cell still exposes its real date for tooling'
        )
      },
    ],
    [
      'a real journal note has no TEMPLATE ribbon',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open a real journal note and confirm it has no TEMPLATE ribbon.')
        ctx.assert.ok(
          await ctx.exists(`${RV} .journal-folder-header`),
          'header renders on the real note'
        )
        ctx.assert.ok(
          !(await ctx.exists(`${RV} [data-jf-template-ribbon]`)),
          'no ribbon on a real journal note'
        )
        await ctx.shot('Real journal note header (no ribbon)', {
          rect: "rectOf('.journal-folder-header')",
        })
      },
    ],
  ],
}
