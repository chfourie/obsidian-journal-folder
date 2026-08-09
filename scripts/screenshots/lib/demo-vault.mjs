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

// Demo-vault lifecycle for the screenshot harness: deploy the freshly built
// bundle, reload the plugin, and — crucially — set per-scene state without any
// manual prep. Unlike the E2E vault (reset with git), the demo vault's
// data.json is git-ignored and user-configured, so we BACK IT UP and restore it
// at the end, applying each scene's settings fixture as a shallow merge over
// that backed-up baseline. Throwaway notes (for the no-folder-title scene),
// mobile emulation, and the light/dark base scheme are likewise set then
// restored, so a run leaves the vault exactly as it found it.

import { execFileSync } from 'node:child_process'
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  rmdirSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evalRaw, command } from '../../../tests/e2e/lib/cli.mjs'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const VAULT_DIR = join(REPO_ROOT, 'docs/demo-vault')
export const PLUGIN_DIR = join(VAULT_DIR, '.obsidian/plugins/journal-folder')
const DATA_JSON = join(PLUGIN_DIR, 'data.json')
const DATA_BACKUP = '/tmp/jf-screenshot-data.json.bak'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- Build artefact deploy -------------------------------------------------

// Copy the freshly built bundle into the demo vault's plugin folder.
export function deployBuild() {
  const built = join(REPO_ROOT, 'main.js')
  if (!existsSync(built)) {
    throw new Error('main.js not found — run `npm run build` first.')
  }
  copyFileSync(built, join(PLUGIN_DIR, 'main.js'))
  copyFileSync(join(REPO_ROOT, 'styles.css'), join(PLUGIN_DIR, 'styles.css'))
  copyFileSync(join(REPO_ROOT, 'manifest.json'), join(PLUGIN_DIR, 'manifest.json'))
}

// Reload the plugin so a redeployed main.js takes effect, then detach every
// markdown leaf — already-open leaves keep a stale (processor-less) preview
// until reopened. Mirrors tests/e2e/lib/vault.mjs:reloadPlugin.
export async function reloadPlugin() {
  try {
    await command(['plugin:reload', 'id=journal-folder'])
  } catch {
    await command(['plugin:disable', 'id=journal-folder'])
    await command(['plugin:enable', 'id=journal-folder'])
  }
  await sleep(1500)
  await evalRaw(
    `(()=>{for(const l of app.workspace.getLeavesOfType('markdown')) l.detach(); return 'ok'})()`
  )
  await sleep(800)
}

// --- Settings fixtures (back up + restore baseline) ------------------------

export function backupData() {
  if (existsSync(DATA_JSON)) copyFileSync(DATA_JSON, DATA_BACKUP)
}

export function restoreData() {
  if (existsSync(DATA_BACKUP)) copyFileSync(DATA_BACKUP, DATA_JSON)
}

function readBaseline() {
  return JSON.parse(readFileSync(DATA_BACKUP, 'utf8'))
}

// Reset settings to the backed-up baseline, shallow-merge `overrides`, persist,
// and tell the live plugin to reload — so a previous scene's fixture can never
// leak into the next. No full plugin reload needed for a settings-only change.
export async function applySettings(overrides = {}) {
  const merged = { ...readBaseline(), ...overrides }
  writeFileSync(DATA_JSON, JSON.stringify(merged, null, 2))
  await evalRaw(
    `(async()=>{const p=app.plugins.plugins['journal-folder']; if(p&&p.onExternalSettingsChange) await p.onExternalSettingsChange(); return 'ok'})()`
  )
  await sleep(300)
}

// --- Throwaway notes (no-folder-title scene) -------------------------------

// Write scene-scoped scratch files (vault-relative paths). Returns the list so
// the caller can delete them after. Waits for Obsidian to index them.
export async function writeTempFiles(files = []) {
  for (const f of files) {
    const abs = join(VAULT_DIR, f.path)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, f.content)
  }
  if (files.length) await sleep(1400)
  return files
}

// Undo writeTempFiles. Scene scratch paths are NOT always disposable: the
// template-preview scene writes into `Templates/journal-folder/`, a folder that
// holds six COMMITTED template notes. The old cleanup recursively removed the
// topmost path segment (`Templates`), so every run deleted tracked demo-vault
// content and left the tree dirty — which the release's clean-tree guard then
// blames on the wrong thing. So: restore anything git tracks, delete only what
// it doesn't, and prune directories one level at a time (a non-recursive rmdir
// fails harmlessly on a folder that still holds real notes).
export async function deleteTempFiles(files = []) {
  for (const f of files) {
    const abs = join(VAULT_DIR, f.path)
    if (isTracked(abs)) {
      execFileSync('git', ['checkout', '--', abs], { cwd: REPO_ROOT })
    } else {
      rmSync(abs, { force: true })
    }
  }

  // Deepest-first, so a scratch tree collapses from the leaves up.
  const dirs = [...new Set(files.map((f) => dirname(join(VAULT_DIR, f.path))))].sort(
    (a, b) => b.length - a.length
  )
  for (let dir of dirs) {
    while (dir.startsWith(VAULT_DIR) && dir !== VAULT_DIR) {
      try {
        rmdirSync(dir)
      } catch {
        break // Non-empty (or gone) — leave it and everything above it alone.
      }
      dir = dirname(dir)
    }
  }
  if (files.length) await sleep(600)
}

function isTracked(abs) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', abs], { cwd: REPO_ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// --- Mobile emulation ------------------------------------------------------

// Toggle Obsidian's mobile emulation (adds `.is-mobile`, narrows the pane so
// the in-note calendar's pickVisibleMonthCount drops to a single enlarged
// month). The CLI `dev:mobile` command is the supported switch.
export async function setMobile(on) {
  await command(['dev:mobile', on ? 'on' : 'off'])
  await sleep(1200)
}

// --- Right-split sidebar width --------------------------------------------

// Normalise the right-split width — a dragged-wide sidebar makes the crop (and
// the hero) look unrealistic. ~290px is a typical real-world width.
export async function normalizeSidebarWidth(px = 290) {
  await evalRaw(
    `(()=>{const rs=document.querySelector('.workspace-split.mod-right-split'); ` +
      `if(rs){rs.style.width='${px}px'; window.dispatchEvent(new Event('resize'));} return 'ok'})()`
  )
  await sleep(400)
}

// --- Base colour scheme (README shots are light) ---------------------------

// `app.getTheme()` returns the *effective* scheme, resolving 'system' to the
// explicit 'obsidian' (dark) / 'moonstone' (light). `app.changeTheme(value)`
// persists and repaints immediately. (Verified-live internal API — see
// docs/agent-notes.md, theme-toggle.ts.)
export function getTheme() {
  return evalRaw(`app.getTheme()`)
}

export async function setTheme(value) {
  await evalRaw(`(()=>{app.changeTheme(${JSON.stringify(value)}); return 'ok'})()`)
  await sleep(500)
}

// --- Recreate the sidebar leaf (resets sticky Svelte panel open-state) ------

// The sidebar's More…/Scope panels keep their open-state between scenes;
// DOM-removing a panel desyncs that state so a later "open" click toggles it
// back closed. A fresh leaf resets it cleanly. Also normalises the width.
export async function recreateSidebar() {
  await evalRaw(
    `(async()=>{app.workspace.detachLeavesOfType('journal-folder-sidebar');` +
      `const lf=app.workspace.getRightLeaf(false);` +
      `await lf.setViewState({type:'journal-folder-sidebar',active:true});` +
      `app.workspace.revealLeaf(lf);` +
      `await new Promise(r=>setTimeout(r,500)); return 'ok'})()`
  )
  await normalizeSidebarWidth()
}

export { sleep }
