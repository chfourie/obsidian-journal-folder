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

// The declarative scene manifest — the canonical, executable record of HOW each
// of the 29 README/docs PNGs is composed: which note, view mode, optional
// settings fixture / throwaway files / mobile emulation, what UI state to drive
// (via the shipped data-jf-* hooks), and which region to crop.
//
// Scene shape:
//   { name, note?, mode='preview', settings?, tempFiles?, mobile?,
//     setup?: async (ctx) => {}, rect, pad=14 }
//
// `ctx` (assembled in run.mjs) exposes the reused E2E page helpers plus the
// screenshot-specific lifecycle/calendar helpers:
//   evalRaw, inPage, click, dispatch, openNote, openSettings, sleep,
//   ensureCalendar, openMore, recreateSidebar.

// --- Shared crop-rect expressions (carried over from the old regenerate.mjs) -

// Header title rows + chip row only (excludes the calendar).
const HEADER_RECT =
  `union('.journal-folder-header-folder-title','.journal-folder-header-title','.journal-folder-header-options')`
// Just the calendar (controls strip + month grids).
const CAL_RECT = `rectOf('.journal-folder-calendar')`
// Chip row (active reading view) ∪ the portaled More panel (in <body>). The
// chip row must be scoped to RV — a hidden live-preview header copy also exists
// at (0,0) and would blow up a whole-document union.
const POPOVER_RECT =
  `(()=>{const a=rectOf('.journal-folder-header-options');const b=bodyRect('[data-jf-more-panel]');` +
  `return {x:Math.min(a.l,b.l),y:Math.min(a.t,b.t),w:Math.max(a.r,b.r)-Math.min(a.l,b.l),h:Math.max(a.b,b.b)-Math.min(a.t,b.t)};})()`
// Plugin settings content pane (horizontal tab chips + body), clamped so a
// scrollable tab doesn't ask sips to crop past the bottom of the window.
const SETTINGS_RECT =
  `(()=>{const r=bodyRect('.vertical-tab-content');return {...r,h:Math.min(r.h,window.innerHeight-r.t-6)};})()`
// Sidebar cropped to its actual content height (the panel is full-window-tall),
// optionally unioned with a portaled menu/panel opening to its left.
const sidebarRect = (extra) =>
  `(()=>{const s=document.querySelector('.journal-folder-sidebar');const r=s.getBoundingClientRect();` +
  `const cb=[...s.querySelectorAll('*')].reduce((m,e)=>{const x=e.getBoundingClientRect();return x.height>0&&x.width>0?Math.max(m,x.bottom):m;},r.top);` +
  (extra
    ? `const e=document.querySelector(${JSON.stringify(extra)});const er=e?e.getBoundingClientRect():{left:r.left,right:r.right,bottom:r.top};` +
      `const l=Math.min(r.left,er.left),rr=Math.max(r.right,er.right),b=Math.max(cb,er.bottom);return {x:l,y:r.top,w:rr-l,h:b-r.top};})()`
    : `return {x:r.left,y:r.top,w:r.width,h:cb-r.top};})()`)
// The whole workspace center + right split (the bird's-eye hero), minus the
// left ribbon / file-explorer split. Width spans both splits; height is clamped
// to the tallest meaningful content (note's rendered sizer vs the sidebar's
// content) + a small margin, so the full-window-tall sidebar doesn't drag a sea
// of whitespace into the crop.
const HERO_RECT =
  `(()=>{const root=document.querySelector('.workspace-split.mod-root');` +
  `const right=document.querySelector('.workspace-split.mod-right-split');` +
  `const rr=root.getBoundingClientRect(),rg=right.getBoundingClientRect();` +
  `const x=Math.min(rr.left,rg.left),top=Math.min(rr.top,rg.top),w=Math.max(rr.right,rg.right)-x;` +
  `const contentBottom=(el,from)=>el?[...el.querySelectorAll('*')].reduce((m,e)=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0?Math.max(m,b.bottom):m;},from):from;` +
  `const noteBottom=contentBottom(document.querySelector('.workspace-leaf.mod-active .markdown-preview-sizer'),top);` +
  `const sbBottom=contentBottom(document.querySelector('.journal-folder-sidebar'),top);` +
  `const bottom=Math.min(Math.max(noteBottom,sbBottom)+24,top+window.innerHeight);` +
  `return {x,y:top,w,h:bottom-top};})()`

// Throwaway journal folder with NO configured title (baseline data.json has
// journalFolderTitle:"" + useFolderNameAsDefaultTitle:false, so the header omits
// the folder-title row). Deleted after the shot.
const NO_TITLE_FOLDER = '_Screenshot Scratch'
const NO_TITLE_FILES = [
  { path: `${NO_TITLE_FOLDER}/journal-folder.md`, content: '---\n---\n' },
  {
    path: `${NO_TITLE_FOLDER}/2026-05-04.md`,
    content: '```journal-header\n```\n\n# Monday, 04 May 2026\n\nA day with no folder title.\n',
  },
]

// Throwaway template note (standardized filename) in a global template folder,
// used to capture the live template preview + TEMPLATE ribbon. Deleted after
// the shot.
const TEMPLATE_FOLDER = 'Templates/journal-folder'
const TEMPLATE_FILES = [
  {
    path: `${TEMPLATE_FOLDER}/monthly-template.md`,
    content:
      '%% JOURNAL NOTE %%\n```journal-header\n```\n\n' +
      '## Theme for the month\n\n## Goals\n- \n- \n\n## Review\n',
  },
]

// Open a journal note inside the sidebar's reach and reveal the sidebar leaf.
async function openWithSidebar(ctx, note) {
  await ctx.openNote(note, 'preview')
  await ctx.recreateSidebar()
}

// Open a sidebar menu panel (More… / folder picker) and force it to position.
// SidebarMenuPanel positions the portaled panel via requestAnimationFrame,
// which is throttled while Obsidian isn't the foreground app during CLI
// driving — leaving the panel at its default top-left until something nudges
// it. A window `resize` runs the panel's reposition synchronously (its
// onresize handler calls updatePanelPosition directly), so the panel lands
// under its trigger deterministically.
async function openSidebarMenu(ctx, triggerSel) {
  await ctx.click(triggerSel)
  await ctx.evalRaw(`(()=>{window.dispatchEvent(new Event('resize')); return 'ok'})()`)
  await ctx.sleep(250)
}

export const SCENES = [
  // ---- Headers (calendar hidden) ----------------------------------------
  { name: 'header-daily', note: 'Personal/2026-05-04', setup: (c) => c.ensureCalendar(false), rect: HEADER_RECT },
  { name: 'header-weekly', note: 'Personal/2026-W19', setup: (c) => c.ensureCalendar(false), rect: HEADER_RECT },
  { name: 'header-monthly', note: 'Personal/2026-05', setup: (c) => c.ensureCalendar(false), rect: HEADER_RECT },
  { name: 'header-quarterly', note: 'Personal/2026-Q2', settings: { quartersEnabled: true }, setup: (c) => c.ensureCalendar(false), rect: HEADER_RECT },
  { name: 'header-yearly', note: 'Personal/2026', setup: (c) => c.ensureCalendar(false), rect: HEADER_RECT },

  // Header with no folder-title row (throwaway title-less journal folder).
  {
    name: 'header-no-folder-title',
    note: `${NO_TITLE_FOLDER}/2026-05-04`,
    tempFiles: NO_TITLE_FILES,
    setup: (c) => c.ensureCalendar(false),
    rect: HEADER_RECT,
  },

  // Template note preview: header rendered as the current period, with the
  // corner TEMPLATE ribbon (calendar visible to show the live preview).
  {
    name: 'template-preview',
    note: `${TEMPLATE_FOLDER}/monthly-template`,
    tempFiles: TEMPLATE_FILES,
    settings: {
      autoTemplateEnabled: true,
      templateFolder: TEMPLATE_FOLDER,
      templatesMigratedToFiles: true,
    },
    setup: (c) => c.ensureCalendar(true),
    rect: `rectOf('.journal-folder-header')`,
    pad: 14,
  },

  // ---- More… popovers (portaled to <body>) ------------------------------
  { name: 'more-popover-daily', note: 'Personal/2026-05-04', setup: async (c) => { await c.ensureCalendar(false); await c.openMore() }, rect: POPOVER_RECT, pad: 11 },
  { name: 'more-popover-weekly', note: 'Personal/2026-W19', setup: async (c) => { await c.ensureCalendar(false); await c.openMore() }, rect: POPOVER_RECT, pad: 11 },
  { name: 'more-popover-monthly', note: 'Personal/2026-05', setup: async (c) => { await c.ensureCalendar(true); await c.openMore() }, rect: POPOVER_RECT, pad: 11 },
  { name: 'more-popover-yearly-quarters', note: 'Personal/2026', settings: { quartersEnabled: true }, setup: async (c) => { await c.ensureCalendar(false); await c.openMore() }, rect: POPOVER_RECT, pad: 11 },

  // ---- Calendars (calendar visible) -------------------------------------
  { name: 'calendar-3-months', note: 'Personal/2026-05-04', setup: (c) => c.ensureCalendar(true), rect: CAL_RECT },
  { name: 'calendar-from-monthly', note: 'Personal/2026-05', setup: (c) => c.ensureCalendar(true), rect: CAL_RECT },
  { name: 'calendar-with-quarters', note: 'Project — Atlas/2026-04-30', settings: { quartersEnabled: true }, setup: (c) => c.ensureCalendar(true), rect: CAL_RECT },

  // Narrow / mobile calendar: single enlarged month under mobile emulation.
  { name: 'calendar-mobile', note: 'Personal/2026-05-04', mobile: true, setup: (c) => c.ensureCalendar(true), rect: CAL_RECT },

  // ---- Signifiers -------------------------------------------------------
  {
    name: 'signifiers-reading',
    note: 'Personal/2026-06-02',
    setup: (c) => c.ensureCalendar(false),
    rect: `union('.el-h2','.el-ul','.el-p','.jf-signifier-gutter')`,
    pad: 12,
  },

  // ---- Task migration (reading view) ------------------------------------
  {
    name: 'task-migration-reading',
    note: 'Personal/2026-06-15',
    setup: (c) => c.ensureCalendar(false),
    rect: `union('.journal-folder-header-title','.markdown-preview-sizer ul, .markdown-preview-sizer .contains-task-list')`,
    pad: 10,
  },

  // ---- Settings tabs ----------------------------------------------------
  {
    name: 'settings-tasks-overview',
    setup: (c) => c.openSettings('tasks'),
    rect: SETTINGS_RECT, pad: 0,
  },
  {
    name: 'settings-tasks-flow-detail',
    setup: async (c) => { await c.openSettings('tasks'); await c.click('.jf-flow-row') },
    rect: SETTINGS_RECT, pad: 0,
  },
  {
    name: 'settings-tasks-status-detail',
    setup: async (c) => {
      await c.openSettings('tasks')
      await c.click('.jf-flow-row')
      await c.inPage(
        `const b=[...document.querySelectorAll('.jf-status-row button,.jf-status-row [role=button]')].find(e=>(e.textContent||'').trim()==='Edit'); ` +
          `if(b){b.dispatchEvent(new MouseEvent('click',{bubbles:true})); await new Promise(r=>setTimeout(r,400));} return !!b;`
      )
    },
    rect: SETTINGS_RECT, pad: 0,
  },
  {
    name: 'settings-signifiers',
    setup: (c) => c.openSettings('signifiers'),
    rect: SETTINGS_RECT, pad: 0,
  },

  // ---- Sidebar ----------------------------------------------------------
  { name: 'sidebar-dynamic', setup: (c) => openWithSidebar(c, 'Personal/2026-05-04'), rect: sidebarRect(), pad: 0 },
  { name: 'sidebar-tasks-panel', setup: (c) => openWithSidebar(c, 'Personal/2026-06-15'), rect: sidebarRect(), pad: 0 },
  {
    name: 'sidebar-more-menu',
    setup: async (c) => { await openWithSidebar(c, 'Personal/2026-05-04'); await openSidebarMenu(c, '.jf-sidebar-more-link') },
    rect: sidebarRect('.jf-sidebar-menu-panel'), pad: 0,
  },
  {
    name: 'sidebar-folder-picker',
    setup: async (c) => { await openWithSidebar(c, 'Personal/2026-05-04'); await openSidebarMenu(c, '.jf-sidebar-folder-button') },
    rect: sidebarRect('.jf-sidebar-menu-panel'), pad: 0,
  },

  // ---- Bird's-eye hero --------------------------------------------------
  {
    name: 'hero-overview',
    setup: async (c) => {
      await c.openNote('Personal/2026-05-04', 'preview')
      await c.ensureCalendar(true)
      await c.recreateSidebar()
    },
    rect: HERO_RECT, pad: 0,
  },

  // ---- Plugin (master) ribbon menu --------------------------------------
  {
    name: 'plugin-menu',
    note: 'Personal/2026-05-04',
    setup: (c) => c.click('[aria-label="Journal Folder menu"]'),
    rect: `bodyRect('.jf-ribbon-menu-panel')`, pad: 4,
  },

  // ---- Status picker (over a sidebar task row) --------------------------
  // Right-click a non-done sidebar status icon — the task is active + in a
  // journal note whose flow defines a migrated status, so the panel also shows
  // the "Migrate task…" row. Sidebar rows are stable Svelte (a reading-view
  // document task re-renders and intermittently dismissed the picker).
  {
    name: 'task-status-picker',
    setup: async (c) => {
      await openWithSidebar(c, 'Personal/2026-06-15')
      await c.inPage(
        `const i=[...document.querySelectorAll('.journal-folder-tasks-row [data-jf-status-icon]')].find(e=>{const s=e.getAttribute('data-jf-status-icon');return s==='open'||s==='in-progress';}); ` +
          `if(!i) return false; const r=i.getBoundingClientRect(); ` +
          `i.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+4,clientY:r.top+4})); ` +
          `await new Promise(r=>setTimeout(r,320)); return true;`
      )
    },
    rect: `bodyRect('[data-jf-status-picker]')`, pad: 10,
  },

  // ---- Task category range cap (edit modal) -----------------------------
  {
    name: 'task-category-edit',
    // Targets the FIRST category row offering an Edit control rather than a
    // category by name: the previous version looked for 'Local', a category the
    // baseline data.json no longer defines, so the scene silently stopped
    // opening any modal. Only category rows carry an Edit button, so the first
    // match is the first category whatever the baseline renames them to.
    setup: async (c) => {
      await c.openSettings('tasks')
      await c.inPage(
        `const b=document.querySelector('.setting-item [aria-label="Edit"]'); if(!b) return false; ` +
          `b.dispatchEvent(new MouseEvent('click',{bubbles:true})); await new Promise(r=>setTimeout(r,400)); return true;`
      )
    },
    rect:
      `(()=>{const m=[...document.querySelectorAll('.modal')].find(e=>e.textContent.includes('Maximum range'));const b=m.getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height};})()`,
    pad: 0,
  },

  // ---- Migration picker modal -------------------------------------------
  {
    name: 'migration-picker',
    note: 'Personal/2026-06-15',
    setup: async (c) => {
      await c.evalRaw(
        `(async()=>{app.commands.executeCommandById('journal-folder:migrate-tasks-from-note'); ` +
          `await new Promise(r=>setTimeout(r,600)); return 'ok'})()`
      )
    },
    rect: `bodyRect('[data-jf-migrate-picker]')`, pad: 10,
  },
]
