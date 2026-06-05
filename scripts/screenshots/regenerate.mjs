#!/usr/bin/env node
// Regenerate the README / docs screenshots from the running Obsidian instance,
// entirely via the Obsidian CLI (see capture.mjs for the mechanism). This file
// is the canonical, executable record of *how each shot is composed* — which
// note, which view mode, what UI state, and what region is cropped.
//
//   node scripts/screenshots/regenerate.mjs            # run every scenario
//   node scripts/screenshots/regenerate.mjs header     # only names matching "header"
//   node scripts/screenshots/regenerate.mjs --list     # list scenario names
//
// Prerequisites:
//   • Obsidian >= 1.12.7 running, CLI enabled (Settings → General → CLI).
//   • The demo vault open and registered as `vault=demo-vault`, in LIGHT mode.
//   • Current build synced in: `npm run build && npm run push` (or cp the three
//     files into docs/demo-vault/.obsidian/plugins/journal-folder/).
//   • If the header code block renders raw (`<pre>`), the processor is stale —
//     `obsidian vault=demo-vault plugin:reload id=journal-folder` (NOT app:reload,
//     which leaves the markdown processor unregistered).
//
// Calendar visibility is a session-sticky in-memory store, so scenarios are
// ORDERED to minimise toggling: calendar-hidden shots first, then visible.

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CAPTURE = resolve(HERE, 'capture.mjs')
const VAULT = 'demo-vault'

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const obsidian = (args) => execFileSync('obsidian', args, { encoding: 'utf8' })
const evalJs = (code) => obsidian([`vault=${VAULT}`, 'eval', `code=${code}`])
const capture = (args) => execFileSync('node', [CAPTURE, ...args], { stdio: 'inherit' })

// A header block rect that excludes the calendar (title rows + chip row only).
const HEADER_RECT =
  `union('.journal-folder-header-folder-title','.journal-folder-header-title','.journal-folder-header-options')`
// The whole header block (includes the calendar when visible).
const HEADER_FULL = `rectOf('.journal-folder-header')`
// Just the calendar (controls strip + month grids).
const CAL_RECT = `rectOf('.journal-folder-calendar')`
// Chip row (active reading view) ∪ the portaled More panel (in <body>).
// Must scope the chip row to RV — a hidden live-preview copy also exists in
// the DOM at (0,0) and would blow up a whole-document union.
const POPOVER_RECT =
  `(()=>{const a=rectOf('.journal-folder-header-options');const b=bodyRect('.journal-folder-header-more-panel');` +
  `return {x:Math.min(a.l,b.l),y:Math.min(a.t,b.t),w:Math.max(a.r,b.r)-Math.min(a.l,b.l),h:Math.max(a.b,b.b)-Math.min(a.t,b.t)};})()`
// Plugin settings content pane (horizontal tab chips + body), clamped so a
// scrollable tab doesn't ask sips to crop past the bottom of the window.
const SETTINGS_RECT =
  `(()=>{const r=bodyRect('.vertical-tab-content');return {...r,h:Math.min(r.h,window.innerHeight-r.t-6)};})()`
// Sidebar cropped to its actual content height (the panel itself is
// full-window-tall), optionally unioned with a portaled menu/panel that may
// open to its left (folder picker, More… panel).
const sidebarRect = (extra) =>
  `(()=>{const s=document.querySelector('.journal-folder-sidebar');const r=s.getBoundingClientRect();` +
  `const cb=[...s.querySelectorAll('*')].reduce((m,e)=>{const x=e.getBoundingClientRect();return x.height>0&&x.width>0?Math.max(m,x.bottom):m;},r.top);` +
  (extra
    ? `const e=document.querySelector('${extra}');const er=e?e.getBoundingClientRect():{left:r.left,right:r.right,bottom:r.top};` +
      `const l=Math.min(r.left,er.left),rr=Math.max(r.right,er.right),b=Math.max(cb,er.bottom);return {x:l,y:r.top,w:rr-l,h:b-r.top};})()`
    : `return {x:r.left,y:r.top,w:r.width,h:cb-r.top};})()`)
// Open + reveal the journal-folder sidebar leaf (idempotent). First dismiss any
// stray modal/menu left open by a previous scenario (they portal to <body> and
// would otherwise bleed into the crop).
const SIDEBAR_OPEN =
  `app.setting.close();` +
  `document.querySelectorAll('.modal-container .modal-close-button').forEach(b=>b.click());` +
  `document.querySelectorAll('.menu').forEach(m=>m.remove());` +
  // Recreate the sidebar leaf from scratch each time. The custom More…/Scope
  // panels are Svelte components whose open-state would otherwise survive
  // between scenarios (DOM-removing the panel desyncs that state, so a later
  // "open" click toggles it back closed). A fresh leaf resets it cleanly.
  `await (async()=>{app.workspace.detachLeavesOfType('journal-folder-sidebar');` +
  `const lf=app.workspace.getRightLeaf(false);await lf.setViewState({type:'journal-folder-sidebar',active:true});` +
  `app.workspace.revealLeaf(lf);` +
  // Normalise the right-split width — a dragged-wide sidebar makes the crop
  // (and the hero) look unrealistic. ~290px is a typical real-world width.
  `const _rs=document.querySelector('.workspace-split.mod-right-split');if(_rs){_rs.style.width='290px';window.dispatchEvent(new Event('resize'));}` +
  `await new Promise(r=>setTimeout(r,500));})()`

/**
 * Each scenario: { name, args } where args are passed to capture.mjs, OR
 * { name, pre, ... } where `pre` is JS run via `obsidian eval` before the
 * capture (used to open settings / sidebar / modals). `pre` returns are
 * ignored; keep them idempotent.
 */
const SCENARIOS = [
  // ---- Headers (calendar hidden) ----------------------------------------
  { name: 'header-daily', args: ['--note', 'Personal/2026-05-04', '--setup', 'await ensureCalendar(false)', '--rect', HEADER_RECT] },
  { name: 'header-weekly', args: ['--note', 'Personal/2026-W19', '--setup', 'await ensureCalendar(false)', '--rect', HEADER_RECT] },
  { name: 'header-monthly', args: ['--note', 'Personal/2026-05', '--setup', 'await ensureCalendar(false)', '--rect', HEADER_RECT] },
  { name: 'header-quarterly', args: ['--note', 'Personal/2026-Q2', '--setup', 'await ensureCalendar(false)', '--rect', HEADER_RECT] },
  { name: 'header-yearly', args: ['--note', 'Personal/2026', '--setup', 'await ensureCalendar(false)', '--rect', HEADER_RECT] },

  // ---- More… popovers (portaled to <body>) ------------------------------
  // Daily/weekly with the calendar hidden; monthly with it visible.
  { name: 'more-popover-daily', args: ['--note', 'Personal/2026-05-04', '--setup', 'await ensureCalendar(false); await openMore()', '--rect', POPOVER_RECT, '--pad', '11'] },
  { name: 'more-popover-weekly', args: ['--note', 'Personal/2026-W19', '--setup', 'await ensureCalendar(false); await openMore()', '--rect', POPOVER_RECT, '--pad', '11'] },
  { name: 'more-popover-monthly', args: ['--note', 'Personal/2026-05', '--setup', 'await ensureCalendar(true); await openMore()', '--rect', POPOVER_RECT, '--pad', '11'] },
  { name: 'more-popover-yearly-quarters', args: ['--note', 'Personal/2026', '--setup', 'await ensureCalendar(false); await openMore()', '--rect', POPOVER_RECT, '--pad', '11'] },

  // ---- Calendars (calendar visible) -------------------------------------
  { name: 'calendar-3-months', args: ['--note', 'Personal/2026-05-04', '--setup', 'await ensureCalendar(true)', '--rect', CAL_RECT] },
  { name: 'calendar-from-monthly', args: ['--note', 'Personal/2026-05', '--setup', 'await ensureCalendar(true)', '--rect', CAL_RECT] },
  { name: 'calendar-with-quarters', args: ['--note', 'Project — Atlas/2026-04-30', '--setup', 'await ensureCalendar(true)', '--rect', CAL_RECT] },

  // ---- Signifiers (new) -------------------------------------------------
  { name: 'signifiers-reading', args: ['--note', 'Personal/2026-06-02', '--setup', 'await ensureCalendar(false)', '--rect', `union('.el-h2','.el-ul','.el-p','.jf-signifier-gutter')`, '--pad', '12'] },

  // ---- Task migration (new) ---------------------------------------------
  { name: 'task-migration-reading', args: ['--note', 'Personal/2026-06-04', '--setup', 'await ensureCalendar(false)', '--rect', `union('.journal-folder-header-title','.markdown-preview-sizer ul, .markdown-preview-sizer .contains-task-list')`, '--pad', '10'] },

  // ---- Settings tabs ----------------------------------------------------
  // The plugin settings render as horizontal tab chips inside .vertical-tab-content;
  // crop that pane (clamped to the viewport height).
  {
    name: 'settings-tasks-overview',
    pre: `app.setting.close();app.setting.open();app.setting.openTabById('journal-folder');await sleep(500);click(byText('Tasks'));`,
    args: ['--no-open', '--rect', SETTINGS_RECT, '--pad', '0'],
  },
  {
    name: 'settings-tasks-flow-detail',
    pre: `app.setting.close();app.setting.open();app.setting.openTabById('journal-folder');await sleep(500);click(byText('Tasks'));await sleep(400);click(document.querySelector('.jf-flow-row'));`,
    args: ['--no-open', '--rect', SETTINGS_RECT, '--pad', '0'],
  },
  {
    name: 'settings-tasks-status-detail',
    pre: `app.setting.close();app.setting.open();app.setting.openTabById('journal-folder');await sleep(500);click(byText('Tasks'));await sleep(400);click(document.querySelector('.jf-flow-row'));await sleep(400);click([...document.querySelectorAll('.jf-status-row *')].find(e=>e.textContent.trim()==='Edit'));`,
    args: ['--no-open', '--rect', SETTINGS_RECT, '--pad', '0'],
  },
  {
    name: 'settings-signifiers',
    pre: `app.setting.close();app.setting.open();app.setting.openTabById('journal-folder');await sleep(500);click(byText('Signifiers'));`,
    args: ['--no-open', '--rect', SETTINGS_RECT, '--pad', '0'],
  },

  // ---- Sidebar ----------------------------------------------------------
  // Open a journal note first (dynamic mode points the sidebar at its folder),
  // then reveal the sidebar leaf. Crop the sidebar container.
  {
    name: 'sidebar-dynamic',
    args: ['--note', 'Personal/2026-05-04', '--setup', SIDEBAR_OPEN, '--rect', sidebarRect(), '--pad', '0'],
  },
  {
    name: 'sidebar-tasks-panel',
    args: ['--note', 'Personal/2026-06-04', '--setup', SIDEBAR_OPEN, '--rect', sidebarRect(), '--pad', '0'],
  },
  {
    name: 'sidebar-more-menu',
    args: ['--note', 'Personal/2026-05-04', '--setup', `${SIDEBAR_OPEN}; await sleep(400); click(document.querySelector('.jf-sidebar-more-link'))`, '--rect', sidebarRect('.jf-sidebar-menu-panel'), '--pad', '0'],
  },
  // NOTE: `sidebar-folder-picker` (the folder dropdown) is NOT auto-regenerated.
  // It is a native Obsidian Menu (`.menu`), which dismisses on the window-focus
  // change that `dev:screenshot` triggers — so it can't be captured open via the
  // CLI. Custom panels/modals (More… panel, scope panel, migration picker) are
  // plain portaled DOM and survive, so we prefer those in the docs. Recapture
  // the folder picker by hand if it's ever needed.

  // ---- Migration picker modal (new) -------------------------------------
  {
    name: 'migration-picker',
    pre: `app.setting.close();document.querySelectorAll('.modal-container .modal-close-button').forEach(b=>b.click());await sleep(200);` +
      `const f=app.vault.getAbstractFileByPath('Personal/2026-06-04.md');const l=app.workspace.getLeaf(false);await l.openFile(f,{state:{mode:'preview'}});await sleep(600);` +
      `app.commands.executeCommandById('journal-folder:migrate-tasks-from-note');`,
    args: ['--no-open', '--rect', `bodyRect('.jf-migrate-picker')`, '--pad', '10'],
  },
]

function list() {
  for (const s of SCENARIOS) console.log(s.name)
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--list')) return list()
  const filter = argv.find((a) => !a.startsWith('--'))
  const todo = SCENARIOS.filter((s) => !filter || s.name.includes(filter))
  if (!todo.length) {
    console.error(`no scenarios match "${filter}"`)
    process.exit(1)
  }
  for (const s of todo) {
    console.log(`\n=== ${s.name} ===`)
    if (s.pre) {
      // Helpers for navigation pre-steps (open settings, drill into a tab, …).
      const helpers =
        `const sleep=ms=>new Promise(r=>setTimeout(r,ms));` +
        `const click=e=>e&&e.dispatchEvent(new MouseEvent('click',{bubbles:true}));` +
        `const byText=(t,root=document)=>[...root.querySelectorAll('.modal *,.menu *,.workspace-leaf *')].find(e=>e.children.length===0&&e.textContent.trim()===t);`
      evalJs(`(async()=>{${helpers} ${s.pre}; return 'ok'})()`)
      sleep(900)
    }
    capture(['--out', s.name, ...s.args])
  }
}

main()
