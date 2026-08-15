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

// The plugin settings tab: rendered declaratively (Obsidian 1.13+) from
// getSettingDefinitions() — grouped sections, navigable sub-pages, and
// integration with Obsidian's settings search.

export const suite = {
  name: 'settings',
  description:
    'The plugin settings dialog, where you tune journalling behaviour. Settings render declaratively: grouped sections up top, sub-pages for templates, patterns, tasks and signifiers, and every option findable through the settings search.',
  settings: {},
  after: async (ctx) => ctx.closeSettings(),
  tests: [
    [
      'settings render declaratively with grouped sections',
      async (ctx) => {
        await ctx.openSettings()
        ctx.step('Open the Journal Folder settings dialog to reveal its grouped sections.')
        ctx.assert.ok(
          await ctx.exists('.modal-container .setting-group'),
          'declarative setting groups rendered'
        )
        for (const name of ['Start of week', 'Enable quarterly notes']) {
          ctx.assert.ok(await ctx.settingExists(name), `"${name}" row present`)
        }
        await ctx.shot('Settings dialog sections', {
          rect: "bodyRect('.modal-container .vertical-tab-content')",
        })
        await ctx.closeSettings()
      },
    ],
    [
      'the expected sub-pages exist',
      async (ctx) => {
        await ctx.openSettings()
        ctx.step('Confirm the template, patterns, Tasks and Signifiers sub-pages are all available.')
        const names = await ctx.inPage(
          `return DA('.modal-container .setting-item.mod-navigable')` +
            `.map((r) => txt(r.querySelector('.setting-item-name')));`
        )
        for (const name of [
          'New-note template',
          'Note title patterns',
          'Tasks',
          'Signifiers',
        ]) {
          ctx.assert.ok(names.includes(name), `${name} page present`)
        }
        await ctx.shot('Available settings sub-pages', {
          rect: "bodyRect('.modal-container .vertical-tab-content')",
        })
        await ctx.closeSettings()
      },
    ],
    [
      'navigating into a sub-page swaps the content',
      async (ctx) => {
        await ctx.openSettings('Tasks')
        ctx.step('Open the Tasks sub-page and confirm its content renders.')
        ctx.assert.contains(
          await ctx.text('.modal-container .vertical-tab-content'),
          'General task settings',
          'tasks page content shown'
        )
        await ctx.shot('Tasks settings page', {
          rect: "bodyRect('.modal-container .vertical-tab-content')",
        })
        await ctx.closeSettings()
        await ctx.openSettings('Signifiers')
        ctx.step('Open the Signifiers sub-page and confirm its editor mounts.')
        ctx.assert.ok(
          await ctx.exists('.modal-container [data-jf-settings-page="signifiers"]'),
          'signifiers page shown'
        )
        await ctx.shot('Signifiers settings page', {
          rect: "bodyRect('.modal-container .vertical-tab-content')",
        })
        await ctx.closeSettings()
      },
    ],
    [
      'plugin settings appear in the settings search',
      async (ctx) => {
        await ctx.openSettings()
        await ctx.inPage(
          `const inp = D('.modal-container input[type=search]') || D('.modal-container .search-input-container input'); ` +
            `if (!inp) return false; inp.value = 'quarterly'; ` +
            `inp.dispatchEvent(new Event('input', {bubbles: true})); await sleep(500); return true;`
        )
        ctx.step("Search the settings dialog for 'quarterly' and find the plugin's option.")
        const hits = await ctx.inPage(
          `return DA('.modal-container .vertical-tab-nav-item, .modal-container .setting-item')` +
            `.filter((r) => r.offsetParent !== null)` +
            `.map((r) => (r.textContent || '').trim());`
        )
        ctx.assert.ok(
          hits.some((t) => t.includes('Enable quarterly notes')),
          'quarterly-notes setting surfaced by search'
        )
        await ctx.shot('Settings search results', {
          rect: "bodyRect('.modal-container')",
        })
        await ctx.closeSettings()
      },
    ],
  ],
}
