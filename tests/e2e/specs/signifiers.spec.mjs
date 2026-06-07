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

// Signifiers in reading view and live preview: icon rendered in a left-margin
// gutter, the matched tag hidden, and the placement modes (margin-column vs
// margin). Baseline config: priority(#important→star), inspiration(#inspiration),
// hide-tag on (both views), placement margin-column.

const RV = '.workspace-leaf.mod-active .markdown-reading-view'
const SRC = '.workspace-leaf.mod-active .markdown-source-view'

export const suite = {
  name: 'signifiers',
  description:
    'Signifiers turn tags into small icons drawn in a left-margin gutter beside your journal entries, hiding the underlying tag text. You can line every icon up in one far-left column or hang each icon next to its own entry, in both reading view and live preview.',
  settings: {},
  tests: [
    [
      'reading view renders signifier icons in a gutter',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Open a daily note in reading view; tagged lines show their signifier icons in the left-margin gutter instead of the raw tags.')
        ctx.assert.ok(
          await ctx.exists(`${RV} .jf-signifier-gutter [data-sig-id="priority"]`),
          'priority (#important) icon rendered'
        )
        ctx.assert.ok(
          await ctx.exists(`${RV} .jf-signifier-gutter [data-sig-id="inspiration"]`),
          'inspiration (#inspiration) icon rendered'
        )
        await ctx.shot('Signifier icons in the reading-view gutter')
      },
    ],
    [
      'matched tag text is hidden in reading view',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('With the icon shown in the gutter, the original tag text is hidden in reading view so the entry reads cleanly.')
        ctx.assert.ok(
          await ctx.exists(`${RV} a.tag.jf-signifier-hidden-tag`),
          'a matched tag carries the hidden-tag class'
        )
        await ctx.shot('Matched tag hidden in reading view')
      },
    ],
    [
      'margin-column placement adds the column modifier',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Under the default margin-column placement, every icon lines up in one far-left column like the rule down a physical journal page.')
        ctx.assert.ok(
          await ctx.exists(`${RV} .jf-signifier-gutter.jf-signifier-column`),
          'column variant present under margin-column'
        )
        await ctx.shot('Icons aligned in a single far-left column')
      },
    ],
    [
      'switching to per-row margin drops the column modifier',
      async (ctx) => {
        await ctx.applySettings({ signifierPlacement: 'margin' })
        await ctx.openNote('Journal/2026-06-06', 'preview')
        ctx.step('Switching to per-row margin placement hangs each icon just left of its own entry, indented to follow the line it belongs to.')
        ctx.assert.ok(
          await ctx.exists(`${RV} .jf-signifier-gutter`),
          'gutter still rendered'
        )
        ctx.assert.ok(
          !(await ctx.exists(`${RV} .jf-signifier-gutter.jf-signifier-column`)),
          'no column modifier under per-row margin'
        )
        await ctx.shot('Icons hung next to each entry (per-row margin)')
      },
    ],
    [
      'live preview renders a gutter marker',
      async (ctx) => {
        await ctx.openNote('Journal/2026-06-06', 'source')
        ctx.step('Signifiers also render while editing: live preview shows the same gutter icons as you type.')
        ctx.assert.ok(
          await ctx.exists(`${SRC} .jf-signifier-gutter.jf-signifier-live [data-sig-id]`),
          'live-preview gutter marker rendered'
        )
        await ctx.shot('Signifier gutter in live preview', { rect: "bodyRect('.workspace-leaf.mod-active .markdown-source-view')" })
      },
    ],
    [
      'live preview reveals the tag on the active line, hides it elsewhere',
      async (ctx) => {
        await ctx.applySettings({ signifierShowTagsOnActiveLine: true })
        await ctx.openNote('Journal/2026-06-06', 'source')
        ctx.step('When you place the cursor on a line, its tag is revealed for editing while signifier tags on other lines stay hidden behind their icons.')
        // Put the cursor on the "#important idea" line (index 5).
        await ctx.eval(
          `(()=>{const l=app.workspace.getLeavesOfType('markdown')` +
            `.find(x=>x.view&&x.view.file&&x.view.file.path==='Journal/2026-06-06.md'); ` +
            `l.view.editor.setCursor({line:5,ch:8}); return 'ok'})()`
        )
        await ctx.sleep(500)
        const state = await ctx.inPage(
          `const lines=[...document.querySelectorAll('${SRC} .cm-line')]; ` +
            `const active=lines.find(e=>(e.textContent||'').includes('idea worth remembering')); ` +
            `const other=lines.find(e=>(e.textContent||'').includes('spark of')); ` +
            `return {activeShows: active?active.textContent.includes('#important'):null, ` +
            `otherHides: other?!other.textContent.includes('#inspiration'):null};`
        )
        ctx.assert.eq(state.activeShows, true, 'active line reveals its tag')
        ctx.assert.eq(state.otherHides, true, 'a non-active signifier line stays hidden')
        await ctx.shot('Active line reveals its tag, others stay hidden', { rect: "bodyRect('.workspace-leaf.mod-active .markdown-source-view')" })
      },
    ],
  ],
}
