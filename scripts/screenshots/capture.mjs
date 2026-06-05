#!/usr/bin/env node
// CLI-driven screenshot capture for the README / docs.
//
// Drives the *running* Obsidian instance entirely through the Obsidian CLI
// (`obsidian <command>`, requires Obsidian >= 1.12.7 with the CLI enabled and
// the app running). This replaces the old AppleScript + Swift-CGEvent +
// `screencapture` harness: the CLI's `eval` dispatches real DOM events that
// fire Svelte handlers, `dev:screenshot` captures the window, and we crop to a
// measured bounding rect with `sips`. No window positioning, no hardcoded
// click coords, no AX queries.
//
// Pipeline per shot:
//   1. obsidian open path=<note>.md          (open the note)
//   2. eval -> set reading/source view mode   (clean, cursor-free reading view)
//   3. eval <setup>                           (optional: open popover, toggle…)
//   4. eval <rect> -> {x,y,w,h,dpr}           (measure the crop region)
//   5. obsidian dev:screenshot path=<tmp>     (full-window PNG, Retina dpr=2)
//   6. sips --cropOffset Y X -c H W           (crop to the measured region)
//
// Usage:
//   node scripts/screenshots/capture.mjs --note "Personal/2026-05-04" \
//        --out header-daily --rect "rectOf('.journal-folder-header')"
//
// Flags:
//   --note    <path>   vault-relative note path WITHOUT .md (required unless --no-open)
//   --out     <name>   output basename under docs/screenshots/ (required)
//   --vault   <name>   target vault (default: demo-vault)
//   --mode    preview|source   view mode (default: preview = reading view)
//   --pad     <px>     CSS-px padding around the measured rect (default: 14)
//   --rect    <js>     JS expression returning {x,y,w,h} in CSS px
//                      (default: rectOf('.journal-folder-header'))
//   --setup   <js>     JS run after open+mode, before measuring (await-able)
//   --settle  <ms>     wait before measuring (default: 1400)
//   --reload           plugin:reload id=journal-folder first (fixes a stale
//                      processor; ALWAYS use this, never `app:reload`)
//   --no-open          skip the open step (capture current state, e.g. a modal)
//   --full             skip cropping; save the whole window
//
// Helpers available inside --rect / --setup expressions:
//   RV          the active reading-view root element
//   Q(sel)      querySelector within RV
//   QA(sel)     [...querySelectorAll] within RV
//   rectOf(x)   {x,y,w,h} for an element or selector (searched in RV)
//   union(...)  bounding union of selectors/elements (searched in RV)
//   bodyRect(x) {x,y,w,h} for an element/selector searched in the WHOLE
//               document (for <body>-portaled popovers/panels/modals)
//   bodyUnion(...) union searched in the whole document

import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = resolve(ROOT, 'docs/screenshots')
const TMP = '/tmp/jf-capture-full.png'

function parseArgs(argv) {
  const a = { vault: 'demo-vault', mode: 'preview', pad: 14, settle: 1400 }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const flags = ['reload', 'no-open', 'full']
    if (k.startsWith('--')) {
      const name = k.slice(2)
      if (flags.includes(name)) a[name.replace('-', '_')] = true
      else a[name] = argv[++i]
    }
  }
  return a
}

function obsidian(args, { quiet = false } = {}) {
  const out = execFileSync('obsidian', args, { encoding: 'utf8' })
  if (!quiet) process.stderr.write(out)
  return out
}

// Run an eval and return the parsed `=> ...` payload (string).
function evalJs(vault, code) {
  const out = obsidian([`vault=${vault}`, 'eval', `code=${code}`], { quiet: true })
  // CLI prints `=> <result>` (possibly multi-line). Strip the marker.
  const m = out.replace(/^=>\s?/, '').trimEnd()
  return m
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

// Preamble injected before every measure/setup expression.
const PREAMBLE = `
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
/* The header More popover is a span[role=button] (AX-invisible); a synthetic
   bubbling MouseEvent fires its Svelte handler. Calendar is a session-sticky
   store, so ensureCalendar() is idempotent. */
const moreBtn = () => RV.querySelector('.journal-folder-header-more span[role=button]');
const moreOpen = () => moreBtn() && moreBtn().getAttribute('aria-expanded') === 'true';
const openMore = async () => { if (!moreOpen()) { click(moreBtn()); await sleep(280); } };
const closeMore = async () => { if (moreOpen()) { click(moreBtn()); await sleep(200); } };
const ensureCalendar = async (want) => {
  const has = () => !!RV.querySelector('.journal-folder-calendar');
  if (has() === want) return;
  await openMore();
  const tog = document.querySelector('.journal-folder-calendar-toggle');
  if (tog) click(tog);
  await sleep(300);
  await closeMore();
};
`.replace(/\n/g, ' ')

async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (!a.out) throw new Error('--out is required')
  mkdirSync(SHOTS, { recursive: true })

  if (a.reload) {
    obsidian([`vault=${a.vault}`, 'plugin:reload', 'id=journal-folder'])
    sleep(1800)
  }

  if (!a.no_open) {
    if (!a.note) throw new Error('--note is required unless --no-open')
    obsidian([`vault=${a.vault}`, 'open', `path=${a.note}.md`])
    sleep(700)
    // Find the markdown leaf showing this file, make it the active leaf, and
    // force the requested view mode. Targeting by path (not getMostRecentLeaf)
    // keeps `.workspace-leaf.mod-active .markdown-reading-view` reliable.
    const path = `${a.note}.md`
    const modeCode =
      `(async()=>{` +
      `const ls=app.workspace.getLeavesOfType('markdown');` +
      `const t=ls.find(l=>l.view&&l.view.file&&l.view.file.path===${JSON.stringify(path)})||ls[0];` +
      `app.workspace.setActiveLeaf(t,{focus:true});` +
      `const s=t.getViewState();s.state.mode=${JSON.stringify(a.mode)};await t.setViewState(s);` +
      `return 'ok'})()`
    evalJs(a.vault, modeCode)
    sleep(900)
  }

  if (a.setup) {
    evalJs(a.vault, `(async()=>{${PREAMBLE}; ${a.setup}; return 'ok'})()`)
    sleep(600)
  }

  sleep(Number(a.settle))

  let crop = null
  if (!a.full) {
    const rectExpr = a.rect || `rectOf('.journal-folder-header')`
    const payload = evalJs(
      a.vault,
      `(()=>{${PREAMBLE}; const R=${rectExpr}; return JSON.stringify({...R, dpr: window.devicePixelRatio});})()`
    )
    let r
    try {
      r = JSON.parse(payload)
    } catch {
      throw new Error(`rect expr did not return JSON: ${payload}`)
    }
    const pad = Number(a.pad)
    const dpr = r.dpr || 2
    crop = {
      x: Math.max(0, Math.round((r.x - pad) * dpr)),
      y: Math.max(0, Math.round((r.y - pad) * dpr)),
      w: Math.round((r.w + 2 * pad) * dpr),
      h: Math.round((r.h + 2 * pad) * dpr),
    }
  }

  obsidian([`vault=${a.vault}`, 'dev:screenshot', `path=${TMP}`])
  sleep(300)

  const outPath = resolve(SHOTS, `${a.out}.png`)
  if (a.full) {
    execFileSync('cp', [TMP, outPath])
  } else {
    // sips: crop a H×W region anchored at offset (Y, X) from the top-left.
    execFileSync('sips', [
      '--cropOffset', String(crop.y), String(crop.x),
      '-c', String(crop.h), String(crop.w),
      TMP, '--out', outPath,
    ], { stdio: 'ignore' })
    console.log(`captured ${a.out}  (${crop.w}x${crop.h} @ ${crop.x},${crop.y})`)
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
