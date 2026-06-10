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

// The "Today" affordance: a one-click jump to today's daily note for a journal
// folder. The e2e vault has TWO journal folders (Journal, Work), neither opted
// into the picker by default — so the action shows a folder picker. Opting a
// single folder in makes it open directly. Placement (todayButtonPlacement)
// routes the affordance to either a dedicated ribbon icon or an item inside the
// existing Journal Folder ribbon menu (or off).

const OPEN_TODAY = `app.commands.executeCommandById('journal-folder:open-today')`

async function runOpenToday(ctx) {
  await ctx.eval(
    `(async()=>{${OPEN_TODAY}; await new Promise(r=>setTimeout(r,500)); return 'ok'})()`
  )
}

async function openRibbonMenu(ctx) {
  await ctx.eval(
    `(async()=>{app.commands.executeCommandById('journal-folder:open-journal-menu'); await new Promise(r=>setTimeout(r,400)); return 'ok'})()`
  )
}

// Count the plugin's top-level Today ribbon icons by their aria-label —
// addRibbonIcon stamps the title onto the ribbon action element. Match on
// "journal note" specifically so this does NOT also count Obsidian's core
// Daily Notes ribbon icon ("Open today's daily note").
function todayRibbonCount(ctx) {
  return ctx.evalJSON(
    `[...document.querySelectorAll('.side-dock-ribbon-action')]` +
      `.filter(e=>(e.getAttribute('aria-label')||'').toLowerCase().includes('journal note')).length`
  )
}

export const suite = {
  name: 'today',
  description:
    'The Today action opens (creating on first visit) the current day’s note for a journal folder. With several eligible folders it shows a picker; opting a single folder in opens it directly. Its placement setting routes it to a dedicated ribbon icon or an item in the existing journal menu.',
  settings: {},
  tests: [
    [
      'the open-today command shows a folder picker when several folders are eligible',
      async (ctx) => {
        ctx.step('Run the Open today command with two eligible journal folders.')
        await runOpenToday(ctx)
        ctx.assert.ok(
          await ctx.exists('.modal-container .prompt-input'),
          'folder picker prompt open'
        )
        ctx.assert.ok(
          (await ctx.count('.modal-container .suggestion-item')) >= 2,
          'picker lists both journal folders'
        )
        ctx.step('With more than one eligible folder the action asks which to open.')
        await ctx.shot('Today folder picker', { rect: "bodyRect('.modal-container .prompt')" })
      },
    ],
    [
      'a single opted-in folder opens today’s note directly, creating it',
      async (ctx) => {
        // Opt only the Work folder into the picker via its config note's front
        // matter — resolveTodayFolders then returns just [Work], so the action
        // skips the picker and opens that folder's note directly.
        await ctx.eval(
          `(async()=>{const f=app.vault.getAbstractFileByPath('Work/journal-folder.md');` +
            `await app.fileManager.processFrontMatter(f, fm=>{fm['include-in-today-picker']=true});` +
            `await new Promise(r=>setTimeout(r,500)); return 'ok'})()`
        )
        ctx.step('Opt the Work folder into the Today picker and run the command.')
        const today = ctx.todayDaily()
        await runOpenToday(ctx)
        ctx.assert.eq(
          await ctx.count('.modal-container .suggestion-item'),
          0,
          'no picker shown for a single eligible folder'
        )
        ctx.assert.ok(
          await ctx.waitFor(() => ctx.noteExists(`Work/${today}.md`)),
          'today’s note created in the opted-in folder'
        )
        const active = await ctx.evalJSON(
          `(app.workspace.getActiveFile()&&app.workspace.getActiveFile().path)||null`
        )
        ctx.assert.eq(active, `Work/${today}.md`, 'opened folder is now active')
        ctx.step('A single eligible folder opens (and creates) today’s note directly.')
      },
    ],
    [
      'placement=ribbon adds a dedicated top-level ribbon icon (and not a menu item)',
      async (ctx) => {
        await ctx.applySettings({ todayButtonPlacement: 'ribbon' })
        ctx.step('Set the Today button placement to a top-level ribbon icon.')
        ctx.assert.eq(await todayRibbonCount(ctx), 1, 'one Today ribbon icon added')
        // With a dedicated icon, the menu must NOT also carry the Today item.
        await openRibbonMenu(ctx)
        ctx.assert.ok(
          !(await ctx.exists('[data-jf-ribbon-menu] [data-jf-menu-item-title^="Open today"]')),
          'no duplicate Today item in the menu'
        )
        await ctx.shot('Today ribbon icon')
      },
    ],
    [
      'placement=menu lists the Today action in the journal menu (and adds no ribbon icon)',
      async (ctx) => {
        await ctx.applySettings({ todayButtonPlacement: 'menu' })
        ctx.step('Set the Today button placement to the journal ribbon menu.')
        ctx.assert.eq(await todayRibbonCount(ctx), 0, 'no dedicated ribbon icon')
        await openRibbonMenu(ctx)
        ctx.assert.ok(
          await ctx.exists('[data-jf-ribbon-menu] [data-jf-menu-item-title^="Open today"]'),
          'Today item present in the journal menu'
        )
        ctx.step('In menu mode the Today action lives inside the existing journal menu.')
        await ctx.shot('Today item in the journal menu', {
          rect: "bodyRect('[data-jf-ribbon-menu]')",
        })
        await ctx.eval(`(()=>{document.body.click(); return 'ok'})()`)
      },
    ],
    [
      'placement=off hides the icon and the menu item (the command still works)',
      async (ctx) => {
        await ctx.applySettings({ todayButtonPlacement: 'off' })
        ctx.step('Turn the Today button off.')
        ctx.assert.eq(await todayRibbonCount(ctx), 0, 'no ribbon icon when off')
        await openRibbonMenu(ctx)
        ctx.assert.ok(
          !(await ctx.exists('[data-jf-ribbon-menu] [data-jf-menu-item-title^="Open today"]')),
          'no Today menu item when off'
        )
        ctx.step('Off hides both affordances; the open-today command remains available.')
        await ctx.eval(`(()=>{document.body.click(); return 'ok'})()`)
      },
    ],
  ],
}
