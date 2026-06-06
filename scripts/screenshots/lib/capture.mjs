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

// Measure → screenshot → crop. The screenshot mechanism, ported from the old
// scripts/screenshots/capture.mjs but async over the shared E2E CLI wrapper
// (tests/e2e/lib/cli.mjs). `dev:screenshot` writes the whole window at Retina
// (devicePixelRatio 2); we `eval` a getBoundingClientRect for the target,
// multiply by the dpr, and `sips --cropOffset Y X -c H W`.
//
// Scenes describe their crop region as a JS expression evaluated in-page with
// the MEASURE_PREAMBLE helpers in scope (rectOf / union / bodyRect / bodyUnion).

import { execFileSync } from 'node:child_process'
import { evalRaw, command, oneLine } from '../../../tests/e2e/lib/cli.mjs'

// Helpers injected before every measure expression. Collapsed to one line by
// the CLI wrapper, so NO `//` line comments here. `RV` is the active reading /
// source view; rect helpers default to searching within it, the `body*` ones
// search the whole document (for <body>-portaled popovers / panels / modals).
export const MEASURE_PREAMBLE = oneLine(`
const RV = document.querySelector('.workspace-leaf.mod-active .markdown-reading-view')
  || document.querySelector('.workspace-leaf.mod-active .markdown-source-view')
  || document.querySelector('.markdown-reading-view')
  || document.body;
const Q = (s) => RV.querySelector(s);
const QA = (s) => [...RV.querySelectorAll(s)];
const _r = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, l: b.left, t: b.top, r: b.right, b: b.bottom }; };
const rectOf = (x, root) => _r(typeof x === 'string' ? (root || RV).querySelector(x) : x);
const _union = (root, sels) => {
  const els = sels.flatMap((s) => typeof s === 'string' ? [...root.querySelectorAll(s)] : [s]);
  const rs = els.map((e) => e.getBoundingClientRect());
  const l = Math.min(...rs.map((x) => x.left)), t = Math.min(...rs.map((x) => x.top));
  const r = Math.max(...rs.map((x) => x.right)), b = Math.max(...rs.map((x) => x.bottom));
  return { x: l, y: t, w: r - l, h: b - t };
};
const union = (...sels) => _union(RV, sels);
const bodyRect = (x) => rectOf(x, document);
const bodyUnion = (...sels) => _union(document, sels);
`)

// Measure a crop rect (CSS px + dpr) from a JS expression. The expression runs
// with the MEASURE_PREAMBLE helpers in scope and must evaluate to {x,y,w,h}.
export async function measureRect(expr) {
  const code =
    `(()=>{ ${MEASURE_PREAMBLE} const R=(${expr}); ` +
    `return JSON.stringify({...R, dpr: window.devicePixelRatio}); })()`
  const raw = await evalRaw(code)
  let r
  try {
    r = JSON.parse(raw)
  } catch {
    throw new Error(`rect expression did not return JSON: ${raw}`)
  }
  return r
}

// Capture the whole Obsidian window (Retina, devicePixelRatio 2) to `fullPath`.
// We keep these full frames so cropping is a separate, pure step: a crop that
// comes out wrong can be re-cut from the saved frame WITHOUT re-driving the app,
// and the frame can be opened to see exactly what state was captured.
export async function screenshotFull(fullPath) {
  await command(['dev:screenshot', `path=${fullPath}`])
}

// Crop the measured rect (+pad CSS px on every side, ×dpr) out of a saved
// full-window PNG into `outPath`. Pure: no Obsidian interaction — re-runnable
// offline to adjust the crop. `rect` is a measureRect() result {x,y,w,h,dpr}.
export function cropFrom(fullPath, outPath, rect, pad = 14) {
  const dpr = rect.dpr || 2
  const crop = {
    x: Math.max(0, Math.round((rect.x - pad) * dpr)),
    y: Math.max(0, Math.round((rect.y - pad) * dpr)),
    w: Math.round((rect.w + 2 * pad) * dpr),
    h: Math.round((rect.h + 2 * pad) * dpr),
  }
  // sips: crop a H×W region anchored at offset (Y, X) from the top-left.
  execFileSync(
    'sips',
    [
      '--cropOffset', String(crop.y), String(crop.x),
      '-c', String(crop.h), String(crop.w),
      fullPath, '--out', outPath,
    ],
    { stdio: 'ignore' }
  )
  return crop
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- Session-sticky calendar / More-popover helpers ------------------------
// The in-note calendar visibility is an in-memory store with no public API, so
// it is toggled through the header More popover. Both helpers are idempotent.
// Driven by the shipped `data-jf-*` hooks (data-jf-more-button / -panel,
// data-jf-calendar-toggle).
//
// CRUCIAL: the active leaf keeps BOTH a reading view and a hidden live-preview
// (source) view in the DOM, so a bare `.mod-active [data-jf-more-button]`
// matches the HIDDEN header copy first (its options sit at 0,0) — opening that
// copy's panel renders it at the top-left with width 0 (a blank crop). Scope
// every interactive reading-view query to `.markdown-reading-view`. The panel
// itself portals to <body>; only the open copy's panel exists at a time.

const RVH = '.workspace-leaf.mod-active .markdown-reading-view'
const MORE_BTN = `${RVH} [data-jf-more-button]`
const MORE_PANEL = '[data-jf-more-panel]'
const CAL = `${RVH} .journal-folder-calendar`
const CAL_TOGGLE = '[data-jf-calendar-toggle]'

const fire = (sel, type) =>
  evalRaw(
    `(async()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; ` +
      `e.dispatchEvent(new MouseEvent(${JSON.stringify(type)},{bubbles:true,cancelable:true})); ` +
      `await new Promise(r=>setTimeout(r,260)); return true;})()`
  )

export async function moreIsOpen() {
  const v = await evalRaw(
    `(()=>{const e=document.querySelector(${JSON.stringify(MORE_BTN)}); ` +
      `return e && e.getAttribute('aria-expanded')==='true' ? '1':'0';})()`
  )
  return v === '1'
}

export async function openMore() {
  if (!(await moreIsOpen())) {
    await fire(MORE_BTN, 'click')
    await sleep(120)
  }
}

export async function closeMore() {
  if (await moreIsOpen()) {
    await fire(MORE_BTN, 'click')
    await sleep(100)
  }
}

const calendarVisible = () =>
  evalRaw(`(()=>!!document.querySelector(${JSON.stringify(CAL)}) ? '1':'0')()`).then(
    (v) => v === '1'
  )

// Toggle the in-note calendar to `want`. After turning it on a cached reading
// view sometimes needs the toggle round-trip to settle; the helper waits.
export async function ensureCalendar(want) {
  if ((await calendarVisible()) === want) return
  await openMore()
  await fire(`${MORE_PANEL} ${CAL_TOGGLE}`, 'click')
  await sleep(300)
  await closeMore()
  await sleep(200)
}
