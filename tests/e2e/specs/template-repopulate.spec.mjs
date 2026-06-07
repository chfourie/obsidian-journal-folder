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

// Sidebar More... → "Re-populate note from template": a destructive action
// that overwrites the active journal note with its resolved template after a
// confirmation. Covers item visibility (journal note vs not, templating on vs
// off), the confirm-and-overwrite path, and the cancel path.

const ROOT = '[data-jf-sidebar-root]'
const MORE_TRIGGER = `${ROOT} .jf-sidebar-header [data-jf-menu-trigger]`
const REPOP_ITEM =
  '[data-jf-menu-panel] [data-jf-menu-item-title="Re-populate note from template"]'
const GLOBAL_DIR = 'Templates/journal-folder'
const NOTE = 'Journal/2026-06-06'
const TEMPLATE_BODY = '# RE-POPULATED FROM TEMPLATE\n\n- fresh\n'

async function ensureFolder(ctx, path) {
  await ctx.eval(
    `(async()=>{const parts=${JSON.stringify(path)}.split('/'); let cur=''; ` +
      `for(const p of parts){cur=cur?cur+'/'+p:p; ` +
      `if(!app.vault.getAbstractFileByPath(cur)){try{await app.vault.createFolder(cur)}catch(e){}}} ` +
      `return 'ok'})()`
  )
}

async function writeDailyTemplate(ctx) {
  await ensureFolder(ctx, GLOBAL_DIR)
  await ctx.createNoteViaApp(`${GLOBAL_DIR}/daily-template.md`, TEMPLATE_BODY)
}

// Open the More... panel over the active note.
async function openMore(ctx, note = NOTE) {
  await ctx.openNote(note, 'preview')
  await ctx.openSidebar()
  await ctx.click(MORE_TRIGGER, { settleMs: 300 })
}

// Click a native-modal button by its visible label (the confirm modal has no
// data hooks; match on text).
async function clickModalButton(ctx, label) {
  await ctx.eval(
    `(()=>{const b=[...document.querySelectorAll('.modal-container button')]` +
      `.find(x=>x.textContent===${JSON.stringify(label)}); ` +
      `if(b) b.dispatchEvent(new MouseEvent('click',{bubbles:true})); return !!b})()`
  )
}

export const suite = {
  name: 'template-repopulate',
  description:
    'The sidebar More... menu offers "Re-populate note from template", a destructive action that overwrites the active journal note with its resolved template after a confirmation. The item only shows for journal notes with templating enabled, and cancelling leaves the note untouched.',
  settings: {
    autoTemplateEnabled: true,
    templateFolder: GLOBAL_DIR,
    templateOverrideFolderName: 'Templates',
    templatesMigratedToFiles: true,
  },
  tests: [
    [
      'the item appears for a journal note and overwrites it after confirm',
      async (ctx) => {
        await writeDailyTemplate(ctx)
        ctx.assert.ok(
          !ctx.readNote(`${NOTE}.md`).includes('RE-POPULATED'),
          'precondition: note does not already match the template'
        )
        await openMore(ctx)
        ctx.step('Open the sidebar More... menu over a journal note and find the re-populate action.')
        ctx.assert.ok(
          await ctx.waitFor(() => ctx.exists(REPOP_ITEM)),
          're-populate item present for a journal note'
        )
        await ctx.shot('Sidebar More... menu with re-populate action', {
          rect: "bodyRect('[data-jf-menu-panel]')",
        })
        await ctx.click(REPOP_ITEM, { settleMs: 400 })
        // Confirm the destructive modal.
        ctx.assert.ok(
          await ctx.waitFor(() =>
            ctx.exists('.modal-container button.mod-warning')
          ),
          'confirmation modal opened'
        )
        ctx.step('Confirm the destructive overwrite and verify the note is replaced with the template.')
        await ctx.shot('Re-populate confirmation modal', {
          rect: "bodyRect('.modal-container .modal')",
        })
        await clickModalButton(ctx, 'Replace')
        ctx.assert.ok(
          await ctx.waitFor(() =>
            ctx.readNote(`${NOTE}.md`).includes('RE-POPULATED FROM TEMPLATE')
          ),
          'note overwritten with the template body'
        )
        await ctx.closeSidebar()
      },
    ],
    [
      'cancelling the confirmation leaves the note unchanged',
      async (ctx) => {
        await writeDailyTemplate(ctx)
        const before = ctx.readNote(`${NOTE}.md`)
        await openMore(ctx)
        ctx.step('Open the re-populate confirmation and cancel it, expecting the note to be left alone.')
        ctx.assert.ok(await ctx.waitFor(() => ctx.exists(REPOP_ITEM)), 'item present')
        await ctx.click(REPOP_ITEM, { settleMs: 400 })
        ctx.assert.ok(
          await ctx.waitFor(() => ctx.exists('.modal-container button.mod-warning')),
          'modal opened'
        )
        await ctx.shot('Re-populate confirmation before cancelling', {
          rect: "bodyRect('.modal-container .modal')",
        })
        await clickModalButton(ctx, 'Cancel')
        await ctx.sleep(400)
        ctx.assert.eq(
          ctx.readNote(`${NOTE}.md`),
          before,
          'note content unchanged after cancel'
        )
        await ctx.closeSidebar()
      },
    ],
    [
      'the item is absent for a non-journal note',
      async (ctx) => {
        await writeDailyTemplate(ctx)
        await openMore(ctx, 'Misc/not-a-journal')
        ctx.step('Open the More... menu over a non-journal note and confirm the re-populate action is absent.')
        ctx.assert.ok(await ctx.exists('[data-jf-menu-panel]'), 'menu open')
        ctx.assert.ok(
          !(await ctx.exists(REPOP_ITEM)),
          'no re-populate item outside a journal note'
        )
        await ctx.shot('More... menu on a non-journal note (no re-populate)', {
          rect: "bodyRect('[data-jf-menu-panel]')",
        })
        await ctx.closeSidebar()
      },
    ],
    [
      'the item is absent when templating is disabled',
      async (ctx) => {
        await writeDailyTemplate(ctx)
        await ctx.applySettings({ autoTemplateEnabled: false })
        await openMore(ctx)
        ctx.step('Disable auto-templating, open the More... menu, and confirm the re-populate action is hidden.')
        ctx.assert.ok(await ctx.exists('[data-jf-menu-panel]'), 'menu open')
        ctx.assert.ok(
          !(await ctx.exists(REPOP_ITEM)),
          'no re-populate item when auto-template is off'
        )
        await ctx.shot('More... menu with templating disabled (no re-populate)', {
          rect: "bodyRect('[data-jf-menu-panel]')",
        })
        await ctx.closeSidebar()
      },
    ],
  ],
}
