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

// Regression: a reading-view task that has a sub-bullet is collapsible, so
// Obsidian draws a `.list-collapse-indicator` — an `position: absolute` box
// wide enough to overlap the checkbox column. Our swapped status icon used to
// be `position: static`, so it painted *under* that box: a click on the icon
// landed on the fold control and toggled the sub-list instead of cycling the
// status (and the two glyphs visibly overlapped). The fix gives the icon
// `position: relative` (mirroring Obsidian's own native checkbox) so it paints
// on top and owns its clicks, while the indicator's exposed left edge stays
// foldable.
//
// `nested-tasks.md` body (0-based line indices):
//   0 `# Nested tasks`
//   1 (blank)
//   2 `- [ ] parent task`     ← collapsible (has the child on line 3)
//   3 `\t- a child bullet`
//   4 `- [ ] lonely task`     ← no children, no fold control

const RV = '.workspace-leaf.mod-active .markdown-reading-view'
const PARENT = `${RV} li[data-jf-doc-line="2"]`

// Hit-test the centre of the parent task's status icon: what element actually
// sits on top there? A direct `dispatchEvent` on the icon would bypass the
// overlap entirely (it targets the node, not a screen point), so the bug is
// only observable through `elementFromPoint` — the same technique the
// live-preview marker-gap regression uses.
const PROBE = `
  const li = document.querySelector(${JSON.stringify(PARENT)});
  if (!li) return { error: 'parent task li not found' };
  const ci = li.querySelector('.list-collapse-indicator');
  const ic = li.querySelector('[data-jf-doc-icon]');
  if (!ci) return { error: 'no collapse indicator — task is not collapsible' };
  if (!ic) return { error: 'no swapped status icon' };
  const r = ic.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const cir = ci.getBoundingClientRect();
  const overlaps = cx >= cir.left && cx <= cir.right && cy >= cir.top && cy <= cir.bottom;
  const top = document.elementFromPoint(cx, cy);
  return {
    overlaps,
    hitIcon: !!top && (top === ic || ic.contains(top)),
    hitIndicator: !!top && (top === ci || ci.contains(top)),
  };
`

export const suite = {
  name: 'task-nested-collapse',
  description:
    'A reading-view task with a sub-bullet is collapsible, so Obsidian overlays a fold control on the checkbox column. The swapped status icon must still own clicks at its own centre (cycling the status, not folding the sub-list) while the fold control’s exposed edge keeps folding.',
  settings: {},
  tests: [
    [
      'a click at the icon centre lands on the status icon, not the fold control',
      async (ctx) => {
        await ctx.openNote('nested-tasks', 'preview')
        ctx.step('Open nested-tasks.md (a task with a sub-bullet) in reading view.')
        const p = await ctx.inPage(PROBE)
        ctx.assert.ok(!p.error, p.error || 'probe resolved')
        // Guard: if the theme stopped overlapping the icon, the regression
        // can't reproduce and a green check would be meaningless.
        ctx.assert.ok(
          p.overlaps,
          'the fold control box overlaps the icon centre (regression is reproducible)'
        )
        ctx.assert.ok(
          p.hitIcon,
          'the status icon is the topmost element at its own centre'
        )
        ctx.assert.ok(
          !p.hitIndicator,
          'the fold control does not cover the icon centre'
        )
        await ctx.shot('Collapsible task icon owns its centre')
      },
    ],
    [
      'clicking the icon cycles the status and does NOT collapse the sub-list',
      async (ctx) => {
        await ctx.openNote('nested-tasks', 'preview')
        ctx.assert.contains(
          ctx.readNote('nested-tasks.md'),
          '- [ ] parent task',
          'precondition: parent task is open'
        )
        ctx.step('Click the parent task’s status icon at its centre (real hit-test).')
        // Click whatever actually sits on top at the icon centre — pre-fix that
        // was the fold control, so this is the true user-facing behaviour.
        const clicked = await ctx.inPage(`
          const li = document.querySelector(${JSON.stringify(PARENT)});
          const ic = li && li.querySelector('[data-jf-doc-icon]');
          if (!ic) return false;
          const r = ic.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!top) return false;
          top.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await sleep(400);
          return true;
        `)
        ctx.assert.ok(clicked, 'dispatched a click at the icon centre')
        const collapsed = await ctx.inPage(
          `const li = document.querySelector(${JSON.stringify(PARENT)});
           return !!li && li.classList.contains('is-collapsed');`
        )
        ctx.assert.ok(!collapsed, 'the sub-list stayed expanded (no fold)')
        ctx.assert.ok(
          await ctx.waitFor(() =>
            ctx.readNote('nested-tasks.md').includes('- [/] parent task')
          ),
          'status cycled open → in-progress on disk'
        )
        ctx.step('The click cycles the task and leaves the sub-bullet visible.')
      },
    ],
    [
      'the fold control still folds the sub-list when clicked on its exposed edge',
      async (ctx) => {
        await ctx.openNote('nested-tasks', 'preview')
        ctx.step('Click the fold control on its exposed left edge (clear of the icon).')
        const before = await ctx.inPage(
          `const li = document.querySelector(${JSON.stringify(PARENT)});
           return !!li && li.classList.contains('is-collapsed');`
        )
        const toggled = await ctx.inPage(`
          const ci = document.querySelector(${JSON.stringify(`${PARENT} .list-collapse-indicator`)});
          if (!ci) return false;
          const r = ci.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + 3, r.top + r.height / 2);
          (top || ci).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await sleep(300);
          return true;
        `)
        ctx.assert.ok(toggled, 'dispatched a click on the fold control edge')
        const after = await ctx.inPage(
          `const li = document.querySelector(${JSON.stringify(PARENT)});
           return !!li && li.classList.contains('is-collapsed');`
        )
        ctx.assert.ok(
          before !== after,
          'the fold control toggled the sub-list (folding still works)'
        )
      },
    ],
  ],
}
