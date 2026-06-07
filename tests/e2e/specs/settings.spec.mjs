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

// The plugin settings tab: the tabbed layout renders, tab switching swaps the
// active panel, and the expected tabs are present.

async function openSettings(ctx) {
  await ctx.eval(
    `(async()=>{app.setting.open(); await app.setting.openTabById('journal-folder'); await new Promise(r=>setTimeout(r,400)); return 'ok'})()`
  )
}
async function closeSettings(ctx) {
  await ctx.eval(`(()=>{app.setting.close(); return 'ok'})()`)
}

export const suite = {
  name: 'settings',
  description:
    'The plugin settings dialog, where you tune journalling behaviour. Its tabbed layout groups related options, and clicking a tab swaps to the matching panel.',
  settings: {},
  after: async (ctx) => closeSettings(ctx),
  tests: [
    [
      'settings tab renders the tab strip',
      async (ctx) => {
        await openSettings(ctx)
        ctx.step('Open the Journal Folder settings dialog to reveal its tab strip.')
        ctx.assert.ok(await ctx.exists('[data-jf-settings-tab]'), 'tab strip rendered')
        ctx.assert.ok(
          (await ctx.count('[data-jf-settings-tab]')) >= 4,
          'several tabs present'
        )
        await ctx.shot('Settings dialog tab strip', {
          rect: "bodyRect('.modal-container .vertical-tab-content')",
        })
        await closeSettings(ctx)
      },
    ],
    [
      'the expected tabs exist',
      async (ctx) => {
        await openSettings(ctx)
        ctx.step('Confirm the General, Tasks and Signifiers tabs are all available.')
        for (const id of ['general', 'tasks', 'signifiers']) {
          ctx.assert.ok(
            await ctx.exists(`[data-jf-settings-tab="${id}"]`),
            `${id} tab present`
          )
        }
        await ctx.shot('Available settings tabs', {
          rect: "bodyRect('.modal-container .vertical-tab-content')",
        })
        await closeSettings(ctx)
      },
    ],
    [
      'clicking a tab swaps the active panel',
      async (ctx) => {
        await openSettings(ctx)
        await ctx.click('[data-jf-settings-tab="tasks"]', { settleMs: 400 })
        ctx.step('Click the Tasks tab and confirm its panel comes to the front.')
        ctx.assert.ok(
          await ctx.exists('[data-jf-tab-panel="tasks"]'),
          'tasks panel shown after clicking its tab'
        )
        await ctx.shot('Tasks settings panel', {
          rect: "bodyRect('.modal-container .vertical-tab-content')",
        })
        await ctx.click('[data-jf-settings-tab="signifiers"]', { settleMs: 400 })
        ctx.step('Switch to the Signifiers tab and confirm its panel replaces the previous one.')
        ctx.assert.ok(
          await ctx.exists('[data-jf-tab-panel="signifiers"]'),
          'signifiers panel shown after clicking its tab'
        )
        await ctx.shot('Signifiers settings panel', {
          rect: "bodyRect('.modal-container .vertical-tab-content')",
        })
        await closeSettings(ctx)
      },
    ],
  ],
}
