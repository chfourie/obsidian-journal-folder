#!/usr/bin/env node
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

// One-command, idempotent README/docs screenshot regeneration. Drives the
// running Obsidian instance against the demo vault entirely through the Obsidian
// CLI (reusing tests/e2e/lib for the CLI/DOM plumbing). Each scene is
// self-setting: a settings fixture over the backed-up baseline data.json, plus
// a data-jf-*-driven setup — so there is ZERO manual vault prep. Behind the same
// preflight the E2E suite proved out (visibility gate → build/deploy → reload →
// detach leaves → readiness probe), so a run never silently produces blank PNGs.
//
//   node scripts/screenshots/run.mjs              # regenerate every scene
//   node scripts/screenshots/run.mjs header       # only names containing "header"
//   node scripts/screenshots/run.mjs --list       # list scene names
//   node scripts/screenshots/run.mjs --no-deploy  # skip build+reload (use current build)
//   node scripts/screenshots/run.mjs --recrop     # re-crop from saved frames only (no Obsidian)
//
// Capture is two phases: a stateful DRIVE (preflight → per scene: set state →
// measure rect → save the full-window frame + a sidecar rect under .captures/)
// and a pure CROP (sips the rect out of the saved frame). `--recrop` runs only
// the crop phase against the last run's saved frames, so a wrong crop / changed
// `pad` is re-cut instantly without re-driving Obsidian, and a saved frame can
// be opened to see exactly what was captured when a crop looks off.
//
// Run with the sandbox OFF (the CLI uses a local IPC socket). The demo vault
// must be open as vault=demo-vault and its window visible. Exit codes:
//   0 = all captured, 1 = capture failures, 2 = environment not ready.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { evalRaw, evalJSON, ensureMainWindow, ensureWindowSize, MIN_WINDOW, VAULT } from '../../tests/e2e/lib/cli.mjs'
import {
  inPage,
  openNote,
  openSettings,
  click,
  dispatch,
  resetUi,
} from '../../tests/e2e/lib/page.mjs'
import {
  REPO_ROOT,
  deployBuild,
  reloadPlugin,
  backupData,
  restoreData,
  applySettings,
  writeTempFiles,
  deleteTempFiles,
  setMobile,
  setTheme,
  recreateSidebar,
  sleep,
} from './lib/demo-vault.mjs'
import { measureRect, screenshotFull, cropFrom, ensureCalendar, openMore } from './lib/capture.mjs'
import { SCENES } from './scenes.mjs'

const SHOTS = resolve(REPO_ROOT, 'docs/screenshots')
// Saved full-window frames + sidecar rects (gitignored), so the crop phase can
// re-run offline (`--recrop`).
const CAPTURES = resolve(REPO_ROOT, 'scripts/screenshots/.captures')
const fullPath = (name) => resolve(CAPTURES, `${name}.png`)
const sidecarPath = (name) => resolve(CAPTURES, `${name}.json`)
const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', dim: '\x1b[2m', bold: '\x1b[1m', cyan: '\x1b[36m' }

function parseArgs(argv) {
  const a = { list: false, bail: false, deploy: true, recrop: false }
  for (const k of argv) {
    if (k === '--list') a.list = true
    else if (k === '--bail') a.bail = true
    else if (k === '--no-deploy') a.deploy = false
    else if (k === '--recrop') a.recrop = true
    else if (!k.startsWith('--') && !a.filter) a.filter = k
  }
  return a
}

function fail(msg) {
  console.error(`${C.red}${msg}${C.reset}`)
  process.exit(2)
}

// The ctx handed to each scene's setup(). The reused E2E page helpers plus the
// screenshot-specific calendar / sidebar helpers.
const ctx = {
  evalRaw,
  inPage,
  click,
  dispatch,
  openNote,
  openSettings,
  ensureCalendar,
  openMore,
  recreateSidebar,
  sleep,
}

async function preflight(deploy) {
  // 1. CLI present.
  try {
    execFileSync('which', ['obsidian'], { stdio: 'ignore' })
  } catch {
    fail('The `obsidian` CLI is not on PATH. Install Obsidian 1.12.7+ and enable its CLI.')
  }

  // 2. Bring the demo vault to the front, then VERIFY it (the repo root can get
  //    opened as its own vault — see docs/agent-notes.md; the bare CLI targets
  //    whatever is focused). Never trust a result until getName() confirms.
  try {
    execFileSync('open', [`obsidian://open?vault=${encodeURIComponent(VAULT)}`])
  } catch {
    /* `open` is macOS-only; focus the window manually elsewhere. */
  }
  await sleep(1500)
  let name = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      name = await evalRaw('app.vault.getName()', { timeoutMs: 8000 })
      if (name) break
    } catch {
      await sleep(1000)
    }
  }
  if (name !== VAULT) {
    fail(
      `Could not reach the '${VAULT}' vault via the CLI (got ${JSON.stringify(name)}).\n` +
        `Open docs/demo-vault in Obsidian (registered name 'demo-vault') and keep its\n` +
        `window focused. The General → "Command line interface" toggle must be on.`
    )
  }

  // 3. Build + deploy + reload (detaches markdown leaves so post-processors
  //    re-run on the next open).
  if (deploy) {
    console.log(`${C.dim}building…${C.reset}`)
    execFileSync('npm', ['run', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' })
    deployBuild()
    await reloadPlugin()
  }

  // 4. Plugin loaded.
  if (!(await evalJSON(`!!app.plugins.plugins['journal-folder']`))) {
    fail(`The journal-folder plugin is not enabled in the '${VAULT}' vault.`)
  }

  // 5. Visibility gate — reading-view markdown lazy-renders only while
  //    document.hidden === false. A window occluded / on another Space /
  //    minimized produces empty previews. Raise it; fail clearly if we can't.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!(await evalJSON(`document.hidden === true`))) break
    try {
      execFileSync('open', ['-a', 'Obsidian'])
    } catch {
      /* non-macOS */
    }
    await sleep(1000)
    if (attempt === 3) {
      fail(
        'The Obsidian window is not visible (document.hidden) — occluded, on ' +
          'another Space, or minimized. Its reading view will not render. Bring the ' +
          'Obsidian window to the foreground and keep it visible while capturing.'
      )
    }
  }

  // 5b. Keep overlays in THIS window. The plugin mounts the ribbon menu, status
  //     picker and modals on `activeDocument`; while a settings popout window is
  //     up that is the popout's document, and every overlay scene fails to
  //     measure a rect it cannot reach. See ensureMainWindow in lib/cli.mjs.
  const mainWindow = await ensureMainWindow()
  if (!mainWindow.ok) {
    fail(
      `The settings dialog is opening in a popout window (${mainWindow.reason}).\n` +
        `Overlay scenes (settings-*, plugin-menu, task-status-picker, migration-picker)\n` +
        `mount on activeDocument and cannot be measured from this window.\n` +
        `Turn off Settings → General → "Open settings in a separate window" and re-run.`
    )
  }

  // 5c. Size gate — every shot is cropped out of a full-window frame, so the
  //     window size IS the layout these images document. The demo vault comes
  //     back at whatever size it was last closed at; at 1024x800 the in-note
  //     calendar collapses to fewer months and the sidebar crowds the note.
  //     Hold it to MIN_WINDOW (see lib/cli.mjs) before capturing anything.
  const sized = await ensureWindowSize(MIN_WINDOW, { exact: true })
  if (!sized.ok) {
    console.warn(
      `${C.red}⚠ Could not resize the Obsidian window to ${MIN_WINDOW.width}x${MIN_WINDOW.height} ` +
        `(${sized.reason}) — shots will document a cramped layout.${C.reset}`
    )
  } else if (sized.resized) {
    const { width, height } = sized.after || sized.want
    console.log(
      `${C.dim}window resized to ${width}x${height} (was ${sized.before.width}x${sized.before.height})${C.reset}`
    )
  }

  // 6. Readiness probe — after a reload the header can render before the
  //    markdown post-processors catch up. The processors (header, document
  //    tasks, signifiers, migration refs) all register together in the
  //    features' load(), so the header + document-tasks both producing output
  //    on a known note is a sufficient warmth signal before capturing (else the
  //    early shots come back blank). 2026-05-04 has a header block + plain
  //    tasks (rendered by the document-tasks processor as [data-jf-doc-line]).
  await resetUi()
  const RVH = '.workspace-leaf.mod-active .markdown-reading-view'
  for (let attempt = 0; attempt < 20; attempt++) {
    await openNote('Personal/2026-05-04', 'preview')
    const ready = await evalJSON(
      `(()=>{const rv=document.querySelector('${RVH}'); if(!rv) return false; ` +
        `return !!rv.querySelector('.journal-folder-header') && ` +
        `!!rv.querySelector('[data-jf-doc-line]');})()`
    )
    if (ready) return
    await sleep(800)
  }
  fail('Plugin loaded but the render pipeline never fully warmed (header + document tasks).')
}

// Drive the scene into its target state, save the full-window frame + the
// measured rect (sidecar), then crop. The saved frame/sidecar let `--recrop`
// re-cut the crop offline.
async function captureScene(scene) {
  await resetUi()
  // Re-pin the window before every scene. Committed PNG dimensions must be
  // reproducible, and the window drifts mid-run (mobile emulation, a closing
  // popout) — which silently rescales every crop after it. Cheap when already
  // correct: one eval that measures and returns.
  if (!scene.mobile) await ensureWindowSize(MIN_WINDOW, { exact: true })
  await applySettings(scene.settings || {})
  if (scene.tempFiles) await writeTempFiles(scene.tempFiles)
  if (scene.mobile) await setMobile(true)
  try {
    if (scene.note) await openNote(scene.note, scene.mode || 'preview')
    if (scene.setup) await scene.setup(ctx)
    await sleep(600)
    const rect = await measureRect(scene.rect)
    await screenshotFull(fullPath(scene.name))
    writeFileSync(sidecarPath(scene.name), JSON.stringify({ rect, pad: scene.pad ?? 14 }, null, 2))
    return cropFrom(fullPath(scene.name), resolve(SHOTS, `${scene.name}.png`), rect, scene.pad ?? 14)
  } finally {
    if (scene.mobile) {
      await setMobile(false)
      await openNote('Personal/2026-05-04', 'preview')
    }
    if (scene.tempFiles) await deleteTempFiles(scene.tempFiles)
  }
}

// Pure crop pass: re-cut each scene's crop from its saved full-window frame,
// applying the scene's CURRENT `pad` (so a pad tweak in scenes.mjs lands without
// re-driving Obsidian). The saved sidecar carries the measured rect.
function recropScene(scene) {
  const full = fullPath(scene.name)
  const side = sidecarPath(scene.name)
  if (!existsSync(full) || !existsSync(side)) {
    throw new Error('no saved frame — run a full capture first')
  }
  const { rect } = JSON.parse(readFileSync(side, 'utf8'))
  return cropFrom(full, resolve(SHOTS, `${scene.name}.png`), rect, scene.pad ?? 14)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const todo = SCENES.filter((s) => !args.filter || s.name.includes(args.filter))

  if (args.list) {
    for (const s of todo) console.log(s.name)
    return 0
  }
  if (!todo.length) {
    console.error(`no scenes match "${args.filter}"`)
    return 1
  }

  mkdirSync(SHOTS, { recursive: true })
  mkdirSync(CAPTURES, { recursive: true })

  // --recrop: pure crop pass from the last run's saved frames — no Obsidian.
  if (args.recrop) {
    console.log(`Obsidian Journal Folder — re-cropping ${todo.length} scenes from saved frames`)
    let okR = 0
    const failR = []
    for (const scene of todo) {
      try {
        const crop = recropScene(scene)
        console.log(`  ${C.green}✓${C.reset} ${scene.name} ${C.dim}(${crop.w}×${crop.h})${C.reset}`)
        okR++
      } catch (e) {
        console.log(`  ${C.red}✗ ${scene.name} — ${e.message}${C.reset}`)
        failR.push(scene.name)
      }
    }
    console.log(`\n${failR.length === 0 ? C.green : C.red}${C.bold}${okR} re-cropped, ${failR.length} failed${C.reset}`)
    return failR.length === 0 ? 0 : 1
  }

  console.log(`Obsidian Journal Folder — screenshots (vault: ${VAULT}, ${todo.length} scenes)`)
  await preflight(args.deploy)

  // Snapshot the demo vault's data.json + base colour scheme so we can restore
  // them after applying per-scene fixtures and forcing light mode.
  backupData()
  const savedTheme = await evalRaw(`app.vault.getConfig('theme')`)
  await setTheme('moonstone') // README shots are light.

  let ok = 0
  let failed = 0
  const failures = []
  try {
    for (const scene of todo) {
      const started = Date.now()
      try {
        const crop = await captureScene(scene)
        const ms = Date.now() - started
        console.log(
          `  ${C.green}✓${C.reset} ${scene.name} ${C.dim}(${crop.w}×${crop.h}, ${ms}ms)${C.reset}`
        )
        ok++
      } catch (e) {
        failed++
        console.log(`  ${C.red}✗ ${scene.name}${C.reset}`)
        console.log(`    ${C.red}${e.message}${C.reset}`)
        failures.push(`${scene.name} — ${e.message}`)
        if (args.bail) break
      }
    }
  } finally {
    // Always leave the vault as we found it.
    await resetUi().catch(() => {})
    restoreData()
    await applySettings({}).catch(() => {}) // reload the live plugin off the restored baseline
    if (savedTheme) await setTheme(savedTheme).catch(() => {})
  }

  console.log(`\n${failed === 0 ? C.green : C.red}${C.bold}${ok} captured, ${failed} failed${C.reset}`)
  if (failures.length) {
    console.log(`\n${C.red}Failures:${C.reset}`)
    for (const f of failures) console.log(`  ${C.red}•${C.reset} ${f}`)
  }

  // Surface what changed for a quick shot-by-shot review gate.
  try {
    const status = execFileSync('git', ['status', '--porcelain', '--', 'docs/screenshots'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim()
    console.log(`\n${C.cyan}git status docs/screenshots:${C.reset}`)
    console.log(status ? status : `${C.dim}(no changes)${C.reset}`)
  } catch {
    /* best effort */
  }

  return failed === 0 ? 0 : 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`${C.red}${e.stack || e.message || e}${C.reset}`)
    process.exit(2)
  })
