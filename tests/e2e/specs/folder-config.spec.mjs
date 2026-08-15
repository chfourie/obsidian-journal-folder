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

// Sentinel value the folder-mode override dropdowns use for the "inherit the
// global config" choice (FOLDER_DEFAULT in journal-folder-settings-tab.ts).
const FOLDER_DEFAULT = '__jf_default__'

async function openMore(ctx) {
  await ctx.openNote('Journal/2026-06-06', 'preview')
  await ctx.openSidebar()
  await ctx.click(MORE, { settleMs: 300 })
}

async function openFolderConfig(ctx) {
  await openMore(ctx)
  await ctx.click(
    '[data-jf-menu-panel] [data-jf-menu-item-title="Edit folder configuration"]',
    { settleMs: 500 }
  )
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
        await openFolderConfig(ctx)
        ctx.step('Open Edit folder configuration to get the folder’s own settings form.')
        ctx.assert.ok(
          await ctx.exists('.modal-container .setting-group'),
          'folder-config modal opened with the grouped settings form'
        )
        // Drill into the patterns sub-page via its navigable entry.
        await ctx.click('.modal-container [data-jf-page-link="patterns"]', { settleMs: 400 })
        // Each per-folder pattern is gated behind a Default/Custom dropdown — the
        // moment input only renders once "Custom" is chosen, so flip the gate first.
        await ctx.setValue(
          '.modal-container [data-jf-setting="dailyNoteShortTitlePattern-mode"] select',
          'custom',
          { settleMs: 400 }
        )
        ctx.assert.ok(
          await ctx.exists('.modal-container [data-jf-setting="dailyNoteShortTitlePattern"] input'),
          'choosing Custom reveals the moment input'
        )
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
    [
      'choosing a concrete value writes an override; "Default" removes it (inherit)',
      async (ctx) => {
        // Round-trip the per-folder "Default (inherit global)" choice on a
        // boolean override. The Journal folder starts with no `quarters-enabled`
        // key (it inherits the global default of off); picking a concrete value
        // writes a sparse override, and picking Default again must remove that
        // key — without disturbing the folder's other front-matter overrides.
        ctx.assert.eq(
          ctx.readNote('Journal/journal-folder.md').includes('quarters-enabled'),
          false,
          'precondition: folder has no quarters-enabled override (inherits global)'
        )

        await openFolderConfig(ctx)
        const DD = '.modal-container [data-jf-setting="quartersEnabled"] select'
        ctx.assert.ok(
          await ctx.exists(DD),
          'folder override dropdown for quartersEnabled present in folder mode'
        )

        // Pick a concrete value that diverges from the global default → override.
        await ctx.setValue(DD, 'true', { settleMs: 500 })
        ctx.step('Set "Enable quarterly notes" to On for this folder only.')
        ctx.assert.ok(
          await ctx.waitFor(() =>
            ctx.readNote('Journal/journal-folder.md').includes('quarters-enabled: true')
          ),
          'concrete choice writes the kebab-cased override to front matter'
        )
        await ctx.shot('Folder override set to a concrete value', {
          rect: "bodyRect('.journal-folder-config-modal-wrap')",
        })

        // Back to Default → the override key must be dropped (inherit restored).
        await ctx.setValue(DD, FOLDER_DEFAULT, { settleMs: 500 })
        ctx.step('Switch it back to Default (inherit the global setting).')
        ctx.assert.ok(
          await ctx.waitFor(
            () => !ctx.readNote('Journal/journal-folder.md').includes('quarters-enabled')
          ),
          'choosing Default removes the override key (inherit restored)'
        )
        // The folder's other override (its title) must survive the round-trip —
        // the save is a sparse diff, not a full rewrite.
        ctx.assert.contains(
          ctx.readNote('Journal/journal-folder.md'),
          'journal-folder-title: Journal',
          'unrelated front-matter overrides are preserved'
        )
        ctx.step('Returning to Default clears just that key, leaving other overrides intact.')
      },
    ],
  ],
}
