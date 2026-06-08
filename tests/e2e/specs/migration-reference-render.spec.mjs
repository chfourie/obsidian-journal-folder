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

// Rendering of a `lucide:` migration-reference marker across the editing
// modes. The marker token written into a note (`lucide:redo-dot [[link]]`)
// renders as a Lucide icon in Live Preview (and reading view), but Source
// mode is a raw editing experience and shows the literal token. Baseline
// config keeps the default lucide markers (redo-dot / undo-dot).

const NOTE = 'migration-ref-demo'
const SRC = '.workspace-leaf.mod-active .markdown-source-view'
// A scratch note at the vault root (not a journal note, so no auto-template
// fires) carrying a task with a forward migration reference on its own line.
const BODY =
  '# Migration reference demo\n\n' +
  '- [>] ship the release notes lucide:redo-dot [[2026-06-06]]\n'

// Is the literal marker token visible in any editor line?
async function rawTokenShown(ctx) {
  return ctx.inPage(
    `const lines=[...document.querySelectorAll('${SRC} .cm-line')]; ` +
      `return lines.some(e=>(e.textContent||'').includes('lucide:redo-dot'));`
  )
}

export const suite = {
  name: 'migration-reference-render',
  description:
    'When a task is migrated, the cross-reference is written as a readable `lucide:<name>` token. The plugin renders it as a small icon in the rendered surfaces — reading view and live preview — while plain Source mode keeps the literal token so the raw markdown stays editable.',
  settings: {},
  tests: [
    [
      'live preview renders the lucide marker as an icon',
      async (ctx) => {
        await ctx.createNoteViaApp(`${NOTE}.md`, BODY)
        await ctx.openNote(NOTE, 'source', { raw: false })
        ctx.step('A migrated task carries a `lucide:redo-dot` reference to its new home; in live preview that token renders as a small icon beside the link instead of raw text.')
        ctx.assert.ok(
          await ctx.exists(`${SRC} .jf-migration-ref-live .jf-migration-ref-icon svg`),
          'lucide marker rendered as an icon in live preview'
        )
        ctx.assert.eq(
          await rawTokenShown(ctx),
          false,
          'the literal lucide: token is replaced by the icon'
        )
        await ctx.shot('Migration reference rendered as an icon in live preview', { rect: "bodyRect('.workspace-leaf.mod-active .markdown-source-view')" })
      },
    ],
    [
      'source mode shows the raw lucide token, no icon',
      async (ctx) => {
        await ctx.createNoteViaApp(`${NOTE}.md`, BODY)
        await ctx.openNote(NOTE, 'source', { raw: true })
        ctx.step('Switching to raw Source mode shows the underlying markdown verbatim — the `lucide:redo-dot` token is left as text and no icon is substituted, so the reference stays editable.')
        ctx.assert.ok(
          !(await ctx.exists(`${SRC} .jf-migration-ref-live`)),
          'no icon substitution in source mode'
        )
        ctx.assert.eq(
          await rawTokenShown(ctx),
          true,
          'the literal lucide:redo-dot token is shown verbatim'
        )
        await ctx.shot('Raw source mode keeps the literal lucide token', { rect: "bodyRect('.workspace-leaf.mod-active .markdown-source-view')" })
      },
    ],
  ],
}
