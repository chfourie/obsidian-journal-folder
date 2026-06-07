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

// Sidebar view: header + mode tag, the folder picker, the More… menu, and
// dynamic-mode following the active note.

const ROOT = '[data-jf-sidebar-root]'
const FOLDER_BTN = `${ROOT} .jf-sidebar-folder-button`
const MORE_TRIGGER = `${ROOT} .jf-sidebar-header [data-jf-menu-trigger]`

// Settings persist to the plugin's data.json; read them from disk.
function setting(ctx, key) {
  return ctx.readSettings()[key]
}

export const suite = {
  name: 'sidebar',
  description:
    'The journal sidebar, your home base for picking a folder, browsing the calendar, and reaching secondary actions. It shows the active folder and mode, and in dynamic mode follows whichever journal note you open.',
  settings: {},
  after: async (ctx) => ctx.closeSidebar(),
  tests: [
    [
      'sidebar shows the folder label and mode tag',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        ctx.step('Open a daily note and the sidebar; it shows the Journal folder and Dynamic mode.')
        ctx.assert.ok(await ctx.exists(ROOT), 'sidebar mounted')
        ctx.assert.contains(
          await ctx.text(`${ROOT} .jf-sidebar-label-mode`),
          'Dynamic',
          'mode tag shows Dynamic (baseline)'
        )
        ctx.assert.contains(
          await ctx.text(`${FOLDER_BTN} .jf-sidebar-folder-button-label`),
          'Journal',
          'selected folder label'
        )
        await ctx.shot('Sidebar with folder label and mode tag', {
          rect: "bodyRect('[data-jf-sidebar-root]')",
        })
      },
    ],
    [
      'folder picker switches the selected folder',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        await ctx.click(FOLDER_BTN, { settleMs: 300 })
        await ctx.click('[data-jf-menu-panel] [data-jf-menu-item-title="Work"]', { settleMs: 400 })
        ctx.step('Use the folder picker to switch the sidebar to the Work journal folder.')
        ctx.assert.contains(
          await ctx.text(`${FOLDER_BTN} .jf-sidebar-folder-button-label`),
          'Work',
          'folder label updated to Work'
        )
        await ctx.shot('Sidebar showing the Work folder selected', {
          rect: "bodyRect('[data-jf-sidebar-root]')",
        })
      },
    ],
    [
      'More… menu lists the expected actions',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        await ctx.click(MORE_TRIGGER, { settleMs: 300 })
        ctx.step('Open the sidebar More… menu to reveal its secondary actions.')
        ctx.assert.ok(await ctx.exists('[data-jf-menu-panel]'), 'More menu open')
        ctx.assert.ok(
          await ctx.exists(
            '[data-jf-menu-panel] [data-jf-menu-item-title="Initialise a new journal folder"]'
          ),
          'init-folder action present'
        )
        ctx.assert.ok(
          await ctx.exists('[data-jf-menu-panel] [data-jf-menu-item-title="Switch to static"]'),
          'mode-toggle action present'
        )
        await ctx.shot('Sidebar More… menu actions', {
          rect: "bodyRect('[data-jf-menu-panel]')",
        })
      },
    ],
    [
      'toggling the mode from the menu persists it',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        await ctx.click(MORE_TRIGGER, { settleMs: 300 })
        ctx.step('Choose Switch to static from the More… menu to change the sidebar mode.')
        await ctx.shot('Mode toggle in the More… menu', {
          rect: "bodyRect('[data-jf-menu-panel]')",
        })
        await ctx.click('[data-jf-menu-panel] [data-jf-menu-item-title="Switch to static"]', {
          settleMs: 400,
        })
        const ok = await ctx.waitFor(() => setting(ctx, 'sidebarMode') === 'static')
        ctx.assert.ok(ok, 'mode persisted as static')
      },
    ],
    [
      'dynamic mode follows the active note to its folder',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        await ctx.openSidebar()
        // Opening a Work journal note should switch the sidebar selection.
        await ctx.openNote('Work/2026-06-06', 'preview')
        await ctx.sleep(500)
        ctx.step('In dynamic mode, opening a Work note makes the sidebar follow it to the Work folder.')
        ctx.assert.contains(
          await ctx.text(`${FOLDER_BTN} .jf-sidebar-folder-button-label`),
          'Work',
          'selection followed the active note (dynamic mode)'
        )
        await ctx.shot('Sidebar following the active note', {
          rect: "bodyRect('[data-jf-sidebar-root]')",
        })
      },
    ],
  ],
}
