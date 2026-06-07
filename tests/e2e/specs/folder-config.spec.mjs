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

// Per-folder configuration via the sidebar: Initialise a new journal folder
// (creates journal-folder.md) and Edit folder configuration (writes kebab-case
// front-matter overrides that diverge from the global settings).

const MORE = '[data-jf-sidebar-root] .jf-sidebar-header [data-jf-menu-trigger]'

async function openMore(ctx) {
  await ctx.openNote('Journal/2026-06-06', 'preview')
  await ctx.openSidebar()
  await ctx.click(MORE, { settleMs: 300 })
}

export const suite = {
  name: 'folder-config',
  description:
    'Per-folder configuration from the sidebar: turning a plain folder into a journal folder, and editing a folder’s own settings so they override the global defaults.',
  settings: {},
  after: async (ctx) => ctx.closeSidebar(),
  tests: [
    [
      'Initialise a new journal folder creates a seeded journal-folder.md',
      async (ctx) => {
        // A plain folder that isn't a journal folder yet.
        await ctx.eval(`(async()=>{await app.vault.createFolder('Inbox'); return 'ok'})()`)
        await ctx.sleep(300)
        await openMore(ctx)
        await ctx.click(
          '[data-jf-menu-panel] [data-jf-menu-item-title="Initialise a new journal folder"]',
          { settleMs: 400 }
        )
        ctx.step('Choose Initialise a new journal folder and pick the Inbox folder.')
        // Drive the fuzzy folder picker: type, then Enter to choose the match.
        await ctx.setValue('.prompt-input', 'Inbox', { settleMs: 400 })
        await ctx.shot('Folder picker for initialising a journal folder', {
          rect: "bodyRect('.modal-container .prompt')",
        })
        await ctx.eval(
          `(()=>{const i=document.querySelector('.prompt-input'); ` +
            `i&&i.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter'})); return 'ok'})()`
        )
        const created = await ctx.waitFor(() => ctx.noteExists('Inbox/journal-folder.md'))
        ctx.assert.ok(created, 'journal-folder.md created in the chosen folder')
        ctx.assert.contains(
          ctx.readNote('Inbox/journal-folder.md'),
          'journal-folder-title: Inbox',
          'seeded with the folder name as title'
        )
      },
    ],
    [
      'Edit folder configuration writes a kebab-case override to front matter',
      async (ctx) => {
        await openMore(ctx)
        await ctx.click(
          '[data-jf-menu-panel] [data-jf-menu-item-title="Edit folder configuration"]',
          { settleMs: 500 }
        )
        ctx.step('Open Edit folder configuration to get the folder’s own settings form.')
        ctx.assert.ok(
          await ctx.exists('.modal-container [data-jf-settings-tab]'),
          'folder-config modal opened with the settings form'
        )
        // Switch to Patterns and change a per-folder field to diverge from global.
        await ctx.click('.modal-container [data-jf-settings-tab="patterns"]', { settleMs: 400 })
        await ctx.setValue(
          '.modal-container [data-jf-setting="dailyNoteShortTitlePattern"] input',
          '[folder]D',
          { settleMs: 400 }
        )
        ctx.step('Override the daily-note title pattern for this folder only.')
        await ctx.shot('Folder-config modal with an overridden pattern', {
          rect: "bodyRect('.journal-folder-config-modal-wrap')",
        })
        const wrote = await ctx.waitFor(() =>
          ctx.readNote('Journal/journal-folder.md').includes('daily-note-short-title-pattern')
        )
        ctx.assert.ok(wrote, 'kebab-cased override written to journal-folder.md')
        ctx.assert.contains(
          ctx.readNote('Journal/journal-folder.md'),
          '[folder]D',
          'the new value is persisted'
        )
      },
    ],
  ],
}
