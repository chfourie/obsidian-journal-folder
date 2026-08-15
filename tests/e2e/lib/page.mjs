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

// In-page DOM driving helpers, layered on the CLI `eval`. Every interaction
// the suite needs (open a note, set view mode, click an element, read text /
// attributes / counts) goes through here so specs read declaratively and never
// hand-roll `eval` strings. Mirrors the helper vocabulary in
// scripts/screenshots/capture.mjs (RV / Q / QA / click / dispatch).

import { evalRaw, evalJSON } from './cli.mjs'

// Injected before every in-page snippet. NOTE: collapsed to one line by the
// CLI wrapper, so this must contain NO `//` line comments.
export const PREAMBLE = `
const D = (s) => document.querySelector(s);
const DA = (s) => [...document.querySelectorAll(s)];
const RV = document.querySelector('.workspace-leaf.mod-active .markdown-reading-view')
  || document.querySelector('.workspace-leaf.mod-active .markdown-source-view')
  || document.querySelector('.workspace-leaf.mod-active')
  || document.body;
const Q = (s) => RV.querySelector(s);
const QA = (s) => [...RV.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fire = (el, type, init) => el && el.dispatchEvent(new MouseEvent(type, Object.assign({bubbles:true, cancelable:true}, init||{})));
const click = (el) => fire(el, 'click');
const keydown = (el, key) => el && el.dispatchEvent(new KeyboardEvent('keydown', {bubbles:true, cancelable:true, key}));
const plugin = () => app.plugins.plugins['journal-folder'];
const txt = (el) => (el ? (el.textContent||'').trim() : null);
`

// Wrap `body` (which must `return` a JSON-encodable value) in an async IIFE
// with the preamble, run it, and return the parsed result.
export async function inPage(body, opts) {
  const code = `(async()=>{ ${PREAMBLE} ${body} })()`
  return evalJSON(code, opts)
}

// Open a note by vault-relative path (without .md) and force a view mode
// ('preview' = reading view, 'source' = live preview / editing). Targets the
// leaf actually showing the file so `.mod-active …` selectors stay reliable.
//
// The editing view ('source') has two sub-modes: Live Preview (rendered) and
// raw Source mode. Pass `raw: true` to force raw Source mode or `raw: false`
// to force Live Preview (overriding the vault's default); leave it undefined
// to inherit the vault default.
export async function openNote(
  path,
  mode = 'preview',
  { settleMs = 700, raw } = {}
) {
  const p = JSON.stringify(`${path}.md`)
  const setSource =
    raw === undefined ? '' : `s.state.source=${raw ? 'true' : 'false'};`
  await evalRaw(
    `(async()=>{` +
      `await app.workspace.openLinkText(${p}, '', false);` +
      `await new Promise(r=>setTimeout(r,250));` +
      `const ls=app.workspace.getLeavesOfType('markdown');` +
      `const t=ls.find(l=>l.view&&l.view.file&&l.view.file.path===${p})||ls[0];` +
      `if(!t) return 'no-leaf';` +
      `app.workspace.setActiveLeaf(t,{focus:true});` +
      `const s=t.getViewState(); s.state.mode=${JSON.stringify(mode)};${setSource}` +
      `await t.setViewState(s);` +
      `await new Promise(r=>setTimeout(r,${settleMs}));` +
      `return 'ok'})()`
  )
}

// Ensure the journal-folder sidebar view is open and revealed in the right
// split. Idempotent — reuses an existing leaf. Sidebar DOM lives outside the
// active markdown leaf, so query it against the whole document.
export async function openSidebar({ settleMs = 900 } = {}) {
  await evalRaw(
    `(async()=>{const t='journal-folder-sidebar';` +
      `let ls=app.workspace.getLeavesOfType(t);` +
      `if(ls.length===0){const leaf=app.workspace.getRightLeaf(false); await leaf.setViewState({type:t,active:true}); ls=app.workspace.getLeavesOfType(t);}` +
      `if(ls[0]) app.workspace.revealLeaf(ls[0]);` +
      `await new Promise(r=>setTimeout(r,${settleMs})); return 'ok'})()`
  )
}

// Dismiss any open modals (native confirm, migration picker, settings) and
// transient portaled panels (status picker, scope panel, menus). Run before
// every test so a modal a previous test left open — even from a previous run —
// can't sit over the reading view and break unrelated assertions. Closing a
// modal via its `.modal-close-button` invokes Obsidian's own `close()`.
export async function resetUi() {
  await evalRaw(
    `(()=>{` +
      `document.querySelectorAll('.modal-container .modal-close-button').forEach((b)=>b.click());` +
      `document.querySelectorAll('.modal-bg').forEach((b)=>b.dispatchEvent(new MouseEvent('click',{bubbles:true})));` +
      `document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));` +
      `document.body.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));` +
      `document.body.dispatchEvent(new MouseEvent('click',{bubbles:true}));` +
      `return 'ok'})()`
  )
}

// Close any open journal-folder sidebar leaves (so a spec can assert a clean
// slate or avoid cross-test interference).
export async function closeSidebar() {
  await evalRaw(
    `(()=>{for(const l of app.workspace.getLeavesOfType('journal-folder-sidebar')) l.detach(); return 'ok'})()`
  )
}

// Does at least one element match (anywhere in the document)?
export function exists(sel) {
  return inPage(`return !!document.querySelector(${JSON.stringify(sel)});`)
}

// Count of matches in the whole document.
export function count(sel) {
  return inPage(`return document.querySelectorAll(${JSON.stringify(sel)}).length;`)
}

// trimmed textContent of the first match (null if none).
export function text(sel) {
  return inPage(
    `const e=document.querySelector(${JSON.stringify(sel)}); return e?(e.textContent||'').trim():null;`
  )
}

// An attribute value of the first match (null if element or attr absent).
export function attr(sel, name) {
  return inPage(
    `const e=document.querySelector(${JSON.stringify(sel)}); return e?e.getAttribute(${JSON.stringify(name)}):null;`
  )
}

// Click the first match; returns whether an element was found. `settleMs`
// lets Svelte/CM handlers + any portaled panel render before the next read.
export async function click(sel, { settleMs = 250 } = {}) {
  const found = await inPage(
    `const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; ` +
      `e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); ` +
      `await new Promise(r=>setTimeout(r,${settleMs})); return true;`
  )
  return found
}

// Set the value of an <input>/<select>/<textarea> and fire input+change so the
// component's onChange handler runs (Obsidian text/dropdown controls listen on
// those). Returns whether the element was found.
export async function setValue(sel, value, { settleMs = 300 } = {}) {
  return inPage(
    `const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; ` +
      `e.value=${JSON.stringify(String(value))}; ` +
      `e.dispatchEvent(new Event('input',{bubbles:true})); ` +
      `e.dispatchEvent(new Event('change',{bubbles:true})); ` +
      `await new Promise(r=>setTimeout(r,${settleMs})); return true;`
  )
}

// Open the plugin settings tab (rendered declaratively on Obsidian 1.13+).
// Optional page names descend the navigable sub-page entries in order, e.g.
// openSettings('Tasks', 'Task flows').
export async function openSettings(...pages) {
  await evalRaw(
    `(async()=>{app.setting.open(); await app.setting.openTabById('journal-folder'); await new Promise(r=>setTimeout(r,400)); return 'ok'})()`
  )
  for (const name of pages) {
    await inPage(
      `const row = DA('.modal-container .setting-item.mod-navigable')` +
        `.filter((r) => r.offsetParent !== null)` +
        `.find((r) => txt(r.querySelector('.setting-item-name')) === ${JSON.stringify(name)}); ` +
        `if (!row) return false; click(row); await sleep(400); return true;`
    )
  }
}

// Locator preamble shared by the by-name setting helpers: declarative rows
// carry no data hooks, so they're addressed by their visible display name
// (hidden rows — `visible: false` definitions — are skipped).
const settingRowLookup = (name) =>
  `const row = DA('.modal-container .setting-item')` +
  `.filter((r) => r.offsetParent !== null)` +
  `.find((r) => txt(r.querySelector('.setting-item-name')) === ${JSON.stringify(name)}); `

export function settingExists(name) {
  return inPage(`${settingRowLookup(name)} return !!row;`)
}

// Click an element inside the named declarative setting row (defaults to the
// toggle's checkbox container).
export async function clickSetting(
  name,
  sub = '.checkbox-container',
  { settleMs = 300 } = {}
) {
  return inPage(
    `${settingRowLookup(name)} const el = row && row.querySelector(${JSON.stringify(sub)}); ` +
      `if (!el) return false; click(el); await sleep(${settleMs}); return true;`
  )
}

// Set the value of the named declarative setting row's input/select control.
export async function setSettingValue(name, value, { settleMs = 300 } = {}) {
  return inPage(
    `${settingRowLookup(name)} const e = row && row.querySelector('input, select, textarea'); ` +
      `if (!e) return false; ` +
      `e.value = ${JSON.stringify(String(value))}; ` +
      `e.dispatchEvent(new Event('input', {bubbles: true})); ` +
      `e.dispatchEvent(new Event('change', {bubbles: true})); ` +
      `await sleep(${settleMs}); return true;`
  )
}

export async function closeSettings() {
  await evalRaw(`(()=>{app.setting.close(); return 'ok'})()`)
}

// Dispatch an arbitrary mouse event (e.g. 'contextmenu') on the first match.
export async function dispatch(sel, type, { settleMs = 250, init = {} } = {}) {
  return inPage(
    `const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; ` +
      `e.dispatchEvent(new MouseEvent(${JSON.stringify(type)},Object.assign({bubbles:true,cancelable:true},${JSON.stringify(init)}))); ` +
      `await new Promise(r=>setTimeout(r,${settleMs})); return true;`
  )
}

