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

// The master ribbon menu (opened via the command, which is also the mobile
// entry point) and the light/dark theme toggle it hosts. The theme toggle
// changes Obsidian's GLOBAL color scheme, so the test restores the original
// scheme afterwards.

async function openRibbonMenu(ctx) {
  await ctx.eval(
    `(async()=>{app.commands.executeCommandById('journal-folder:open-journal-menu'); await new Promise(r=>setTimeout(r,400)); return 'ok'})()`
  )
}

function ribbonIconCount(ctx, label) {
  return ctx.evalJSON(
    `[...document.querySelectorAll('.side-dock-ribbon-action')]` +
      `.filter(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}).length`
  )
}

const FOLDER_SIDEBAR_ROW =
  '[data-jf-ribbon-menu] [data-jf-menu-item-title="Open Journal Folder sidebar"]'

export const suite = {
  name: 'ribbon-theme',
  description:
    'The master journal menu, opened from the ribbon (and the main entry point on mobile), and the light/dark theme toggle it hosts for switching Obsidian’s colour scheme.',
  settings: {},
  tests: [
    [
      'the ribbon menu command opens the panel with actions',
      async (ctx) => {
        await openRibbonMenu(ctx)
        ctx.step('Open the journal ribbon menu and confirm it lists its actions.')
        ctx.assert.ok(await ctx.exists('[data-jf-ribbon-menu]'), 'ribbon menu panel open')
        ctx.assert.ok(
          (await ctx.count('[data-jf-ribbon-menu] [data-jf-menu-item]')) >= 2,
          'menu lists actions'
        )
        ctx.assert.ok(
          await ctx.exists('[data-jf-ribbon-menu] [data-jf-menu-item-title^="Switch to"]'),
          'theme-toggle action present'
        )
        await ctx.shot('Ribbon menu panel', {
          rect: "bodyRect('[data-jf-ribbon-menu]')",
        })
        // Dismiss the menu.
        await ctx.eval(`(()=>{document.body.click(); return 'ok'})()`)
      },
    ],
    [
      'the theme toggle flips Obsidian’s color scheme',
      async (ctx) => {
        const before = await ctx.eval(`app.getTheme()`)
        try {
          await openRibbonMenu(ctx)
          ctx.step('Use the ribbon menu’s theme toggle to flip Obsidian’s colour scheme.')
          await ctx.shot('Theme toggle in the ribbon menu', {
            rect: "bodyRect('[data-jf-ribbon-menu]')",
          })
          await ctx.click('[data-jf-ribbon-menu] [data-jf-menu-item-title^="Switch to"]', {
            settleMs: 500,
          })
          const after = await ctx.eval(`app.getTheme()`)
          ctx.assert.notEq(after, before, 'effective theme changed')
        } finally {
          // Restore the user's original scheme regardless of outcome.
          await ctx.eval(`(()=>{app.changeTheme(${JSON.stringify(before)}); return 'ok'})()`)
        }
      },
    ],
    [
      'a menu action placed on the ribbon gets its own icon and leaves the menu',
      async (ctx) => {
        const label = 'Open Journal Folder sidebar'
        await ctx.applySettings({ folderSidebarButtonPlacement: 'ribbon' })
        ctx.step('Move “Open Journal Folder sidebar” to a top-level ribbon icon.')
        ctx.assert.eq(await ribbonIconCount(ctx, label), 1, 'dedicated ribbon icon added')
        await openRibbonMenu(ctx)
        ctx.assert.ok(!(await ctx.exists(FOLDER_SIDEBAR_ROW)), 'no duplicate menu row')
        await ctx.eval(`(()=>{document.body.click(); return 'ok'})()`)

        await ctx.applySettings({ folderSidebarButtonPlacement: 'off' })
        ctx.step('Turn it off: neither the icon nor the menu row remains.')
        ctx.assert.eq(await ribbonIconCount(ctx, label), 0, 'ribbon icon removed')
        await openRibbonMenu(ctx)
        ctx.assert.ok(!(await ctx.exists(FOLDER_SIDEBAR_ROW)), 'no menu row when off')
        await ctx.eval(`(()=>{document.body.click(); return 'ok'})()`)
      },
    ],
  ],
}
