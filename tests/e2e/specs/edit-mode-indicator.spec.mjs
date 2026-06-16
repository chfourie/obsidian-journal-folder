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

// The edit-mode indicator: a global-only, default-off toggle that paints a
// left-edge rule on the editing surface so it's obvious at a glance you're
// editing, not reading. The rule is an inset box-shadow on the `.cm-editor`,
// keyed off Obsidian's own mode classes — accent in Live Preview, muted in
// Source mode, nothing in reading view (its source view is display:none).

const ACTIVE = '.workspace-leaf.mod-active'
const LP = `${ACTIVE} .markdown-source-view.is-live-preview`
const SRC = `${ACTIVE} .markdown-source-view:not(.is-live-preview)`

// Computed box-shadow of the editing surface's `.cm-editor`, or 'none'/null.
const editorShadow = (ctx, sel) =>
  ctx.inPage(
    `const ed=document.querySelector(${JSON.stringify(`${sel} .cm-editor`)}); ` +
      `return ed?getComputedStyle(ed).boxShadow:null;`
  )

export const suite = {
  name: 'edit-mode-indicator',
  description:
    'The edit-mode indicator draws a coloured rule down the left edge of the editor so you can tell at a glance whether a note is being edited or read: an accent rule in Live Preview, a muted-grey rule in Source mode, and nothing in reading view.',
  settings: { editModeIndicator: true },
  tests: [
    [
      'live preview shows an accent left-edge rule',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'source', { raw: false })
        ctx.step('With the indicator on, editing a note in Live Preview paints an accent rule down the editor’s left edge.')
        ctx.assert.ok(
          await ctx.exists(LP),
          'live-preview editor is active'
        )
        const shadow = await editorShadow(ctx, LP)
        ctx.assert.ok(
          typeof shadow === 'string' && shadow.includes('inset'),
          `live-preview editor carries an inset rule (got ${shadow})`
        )
        await ctx.shot('Accent left-edge rule in live preview', {
          rect: "bodyRect('.workspace-leaf.mod-active .markdown-source-view')",
        })
      },
    ],
    [
      'source mode shows a muted left-edge rule',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'source', { raw: true })
        ctx.step('Raw Source mode gets the same left-edge rule in a muted grey, so it still reads as “editing” without competing with the text.')
        ctx.assert.ok(await ctx.exists(SRC), 'source-mode editor is active')
        const shadow = await editorShadow(ctx, SRC)
        ctx.assert.ok(
          typeof shadow === 'string' && shadow.includes('inset'),
          `source-mode editor carries an inset rule (got ${shadow})`
        )
        await ctx.shot('Muted left-edge rule in source mode', {
          rect: "bodyRect('.workspace-leaf.mod-active .markdown-source-view')",
        })
      },
    ],
    [
      'reading view shows no rule (the source view is hidden)',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Reading view shows no indicator at all — Obsidian hides the editing surface, so nothing competes with the rendered note.')
        ctx.assert.ok(
          await ctx.exists(`${ACTIVE} .markdown-reading-view`),
          'reading view is shown'
        )
        // The source-view DOM is retained but display:none in reading view, so
        // its (still-styled) editor is not visible to the reader.
        const sourceVisible = await ctx.inPage(
          `const sv=document.querySelector(${JSON.stringify(`${ACTIVE} .markdown-source-view`)}); ` +
            `return sv?(sv.offsetParent!==null && sv.offsetWidth>0):false;`
        )
        ctx.assert.eq(
          sourceVisible,
          false,
          'no editing surface is visible in reading view'
        )
        await ctx.shot('Reading view shows no edit-mode rule')
      },
    ],
    [
      'with the setting off, live preview shows no rule',
      async (ctx) => {
        await ctx.applySettings({ editModeIndicator: false })
        await ctx.openNote('Journal/2026-06-06', 'source', { raw: false })
        ctx.step('Turning the indicator off (the default) removes the rule entirely — the editor looks exactly as Obsidian draws it.')
        ctx.assert.ok(await ctx.exists(LP), 'live-preview editor is active')
        const shadow = await editorShadow(ctx, LP)
        ctx.assert.eq(shadow, 'none', 'no inset rule when the setting is off')
        await ctx.shot('Editor with the indicator disabled', {
          rect: "bodyRect('.workspace-leaf.mod-active .markdown-source-view')",
        })
      },
    ],
  ],
}
