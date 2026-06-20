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

// Live-preview task-status interaction. The reading-view / sidebar surfaces are
// covered in task-status.spec.mjs; this exercises the CodeMirror live-preview
// path (document-task-live-preview.ts), where the native checkbox is
// `display:none` and the plugin's injected icon (`[data-jf-task-icon]`) takes
// the click. Cycling there commits through Obsidian's `Editor` API rather than
// a disk write, so we assert the open editor's buffer (the authoritative copy
// in live preview) and then force a save to confirm it reaches disk.
//
// Journal/2026-06-06 body has the open task on (0-based) line 11
// ("- [ ] open task one").

const SRC = '.workspace-leaf.mod-active .markdown-source-view'
const LP_ICON = `${SRC} [data-jf-task-icon]`
const TASK_LINE = 11

// Read the active editor's buffer line — in live preview the editor buffer is
// authoritative (the disk write lags behind a debounced save), so this is the
// most reliable witness that a cycle landed.
function editorLine(ctx, n) {
  return ctx.evalJSON(
    `(()=>{const ed=app.workspace.activeEditor&&app.workspace.activeEditor.editor;` +
      `return ed?ed.getLine(${n}):null;})()`
  )
}

// Force Obsidian to flush the open editor buffer to disk so a disk-level
// assertion doesn't race the debounced auto-save.
function saveActive(ctx) {
  return ctx.eval(
    `(async()=>{app.commands.executeCommandById('editor:save-file');` +
      `await new Promise(r=>setTimeout(r,200));return 'ok'})()`
  )
}

// Detach every open markdown leaf so the next `openNote` builds a fresh editor
// reading from disk. The harness resets the vault *on disk* before each test,
// but a prior live-preview test can leave the open editor buffer dirty (a cycle
// that wasn't saved); reusing that leaf would carry the stale buffer into the
// next test. Closing the leaf first guarantees a clean per-test start state.
function detachMarkdownLeaves(ctx) {
  return ctx.eval(
    `(()=>{for(const l of app.workspace.getLeavesOfType('markdown'))l.detach();return 'ok'})()`
  )
}

// The live-preview swap cycles on `mousedown` (the trailing click is swallowed),
// so the e2e `click` helper — which only dispatches `click` — won't trigger it.
// Dispatch a primary-button mousedown straight at the icon span.
function mousedownIcon(ctx, sel) {
  return ctx.inPage(
    `const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;` +
      `e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));` +
      `await sleep(600);return true;`
  )
}

export const suite = {
  name: 'task-live-preview',
  description:
    'In live preview the native checkbox is hidden and the plugin’s status icon takes the interaction. Left-clicking the icon — anywhere across its hit target, including the gap between the icon and the task text — cycles the status through the active flow and commits it via the editor; right-clicking opens the status picker.',
  settings: {},
  tests: [
    [
      'left-click on the live-preview icon cycles open → in-progress and persists',
      async (ctx) => {
        await detachMarkdownLeaves(ctx)
        await ctx.openNote('Journal/2026-06-06', 'source', { raw: false })
        ctx.step('Open Journal/2026-06-06 in live preview; its open task is on line 11.')
        ctx.assert.contains(
          ctx.readNote('Journal/2026-06-06.md'),
          '- [ ] open task one',
          'precondition: task starts open'
        )
        ctx.assert.ok(
          await ctx.waitFor(() => ctx.exists(LP_ICON)),
          'live-preview status icon injected for the task'
        )

        ctx.assert.ok(await mousedownIcon(ctx, LP_ICON), 'icon found and clicked')

        // The icon is rebuilt for the new status; its cached status attribute is
        // the in-DOM proof the buffer was re-parsed as in-progress.
        ctx.assert.ok(
          await ctx.waitFor(
            async () =>
              (await ctx.attr(LP_ICON, 'data-jf-icon-status')) === 'in-progress'
          ),
          'icon repainted to the in-progress status'
        )
        // Editor buffer is authoritative in live preview.
        ctx.assert.eq(
          await editorLine(ctx, TASK_LINE),
          '- [/] open task one',
          'editor buffer advanced the task to in-progress'
        )
        // …and a save flushes that through to disk.
        await saveActive(ctx)
        ctx.assert.ok(
          await ctx.waitFor(
            () => ctx.readNote('Journal/2026-06-06.md').includes('- [/] open task one'),
            { timeout: 6000 }
          ),
          'in-progress status persisted to disk'
        )
        ctx.step('Clicking the live-preview icon cycles the task to in-progress and saves it.')
        await ctx.shot('Live-preview task cycled to in-progress')
      },
    ],
    [
      'clicking the marker gap right of the icon cycles too (does not drop into the editor)',
      async (ctx) => {
        // Regression for the live-preview checkbox click-through bug: the gap
        // between the icon and the task text was a CSS margin (outside the
        // icon's hit box), so a click landing there fell through to the
        // `cm-line` and CodeMirror placed the caret instead of cycling. A
        // transparent `::after` overlay now extends the icon's hit target
        // across that gap, so `elementFromPoint` in the gap resolves back to
        // the icon and the click cycles the status.
        await detachMarkdownLeaves(ctx)
        await ctx.openNote('Journal/2026-06-06', 'source', { raw: false })
        ctx.step('Open the daily note in live preview and aim a click at the gap just right of the status icon.')
        ctx.assert.ok(
          await ctx.waitFor(() => ctx.exists(LP_ICON)),
          'live-preview status icon present'
        )

        // Resolve the element at a point a few px into the marker gap and, if
        // it resolves back to the icon (the fix), dispatch the cycling
        // mousedown on it — exactly the element a real pointer would hit.
        const probe = await ctx.inPage(
          `const icon=document.querySelector(${JSON.stringify(LP_ICON)});` +
            `if(!icon)return {ok:false};` +
            `icon.scrollIntoView({block:'center'});await sleep(120);` +
            `const r=icon.getBoundingClientRect();` +
            `const x=r.right+3;const y=r.top+r.height/2;` +
            `const hit=document.elementFromPoint(x,y);` +
            `const resolvesToIcon=!!(hit&&hit.closest('[data-jf-task-icon]'));` +
            `if(hit)hit.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y}));` +
            `await sleep(600);` +
            `return {ok:true,resolvesToIcon,hit:hit?(hit.className||hit.tagName):null};`
        )
        ctx.assert.ok(probe.ok, 'probe ran against the icon')
        ctx.assert.ok(
          probe.resolvesToIcon,
          `a click in the marker gap resolves to the icon, not the editor line (hit: ${probe.hit})`
        )
        // And the gap-click actually cycled the task — proving the hit target,
        // not just the geometry.
        ctx.assert.eq(
          await editorLine(ctx, TASK_LINE),
          '- [/] open task one',
          'gap-click cycled the task to in-progress'
        )
        ctx.step('A click in the gap right of the icon is captured by the icon and cycles the status — it no longer drops into source editing.')
      },
    ],
    [
      'right-click on the live-preview icon opens the status picker',
      async (ctx) => {
        await detachMarkdownLeaves(ctx)
        await ctx.openNote('Journal/2026-06-06', 'source', { raw: false })
        ctx.step('Open the daily note in live preview and right-click the status icon.')
        ctx.assert.ok(
          await ctx.waitFor(() => ctx.exists(LP_ICON)),
          'live-preview status icon present'
        )
        const before = await editorLine(ctx, TASK_LINE)
        await ctx.dispatch(LP_ICON, 'contextmenu', { settleMs: 400 })
        ctx.assert.ok(
          await ctx.exists('[data-jf-status-picker]'),
          'status picker portaled open from live preview'
        )
        ctx.assert.ok(
          (await ctx.count('[data-jf-status-picker] [data-jf-status-option]')) >= 3,
          'picker lists the flow statuses'
        )
        // The task is untouched — a right-click opens the menu, it doesn't cycle.
        ctx.assert.eq(
          await editorLine(ctx, TASK_LINE),
          before,
          'right-click left the status unchanged'
        )
        ctx.step('Right-clicking opens the status picker without changing the task.')
        await ctx.shot('Live-preview status picker', { rect: "bodyRect('[data-jf-status-picker]')" })
      },
    ],
  ],
}
