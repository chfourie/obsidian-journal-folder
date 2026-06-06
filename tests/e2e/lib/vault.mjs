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

// Vault lifecycle helpers: reset the committed fixtures with git (so every run
// starts from a known state and `git status` reveals exactly what a write-path
// test changed), deploy the freshly built main.js, reload the plugin, apply a
// settings fixture, and read/create notes. The git-revert strategy is the
// repeatability backbone — the vault is checked into the repo and restored
// after each spec.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evalRaw } from './cli.mjs'
import { command } from './cli.mjs'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const VAULT_REL = 'tests/e2e/jf-e2e-vault'
export const VAULT_DIR = join(REPO_ROOT, VAULT_REL)
export const PLUGIN_DIR = join(VAULT_DIR, '.obsidian/plugins/journal-folder')
const DATA_JSON = join(PLUGIN_DIR, 'data.json')

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' })
}

// Restore the committed vault fixtures and drop any test-created notes. The
// built main.js is gitignored so `clean` leaves it; workspace.json is
// gitignored too. Tracked notes that a spec rewrote are reverted by checkout.
//
// SAFETY: `git clean` would DELETE the entire vault if it weren't tracked, so
// we refuse to run unless git already knows the vault (committed or staged).
// This prevents wiping the fixtures during first-time setup.
export function resetVault() {
  const tracked = git(['ls-files', '--', VAULT_REL]).trim()
  if (!tracked) {
    throw new Error(
      `Refusing to reset: ${VAULT_REL} has no git-tracked files. Commit (or at\n` +
        `least \`git add\`) the e2e vault first so its fixtures can be restored\n` +
        `safely — otherwise \`git clean\` would delete them.`
    )
  }
  git(['checkout', '--', VAULT_REL])
  git(['clean', '-fdq', VAULT_REL])
}

// What changed under the vault, per `git status --porcelain` (ignores the
// gitignored main.js / workspace.json). Returns an array of {status, path}.
export function vaultStatus() {
  const out = git(['status', '--porcelain', '--', VAULT_REL])
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => ({ status: line.slice(0, 2).trim(), path: line.slice(3) }))
}

// Copy the freshly built bundle into the e2e vault's plugin folder.
export function deployBuild() {
  const built = join(REPO_ROOT, 'main.js')
  if (!existsSync(built)) {
    throw new Error('main.js not found — run `npm run build` first (or use test:e2e:build).')
  }
  copyFileSync(built, join(PLUGIN_DIR, 'main.js'))
  copyFileSync(join(REPO_ROOT, 'styles.css'), join(PLUGIN_DIR, 'styles.css'))
  copyFileSync(join(REPO_ROOT, 'manifest.json'), join(PLUGIN_DIR, 'manifest.json'))
}

// Reload the plugin so a redeployed main.js takes effect. Prefer the dedicated
// CLI command; fall back to disable+enable if it's gated in this vault.
// After a reload the markdown post-processors re-register, but already-open
// leaves keep their stale (processor-less) preview until reopened — so detach
// every markdown leaf, forcing fresh renders for all subsequent openNote calls.
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

// Read the settings currently on disk (baseline after resetVault, or baseline
// + suite settings once the harness has applied them for this test).
export function readSettings() {
  return JSON.parse(readFileSync(DATA_JSON, 'utf8'))
}

// Apply a settings fixture: shallow-merge `overrides` over whatever is
// currently on disk (so a test's overrides stack on its suite's settings),
// persist it, and tell the live plugin to reload its settings — no full reload
// needed for a settings-only change.
export async function applySettings(overrides = {}) {
  const base = readSettings()
  const merged = { ...base, ...overrides }
  writeFileSync(DATA_JSON, JSON.stringify(merged, null, 2))
  await evalRaw(
    `(async()=>{const p=app.plugins.plugins['journal-folder']; if(p&&p.onExternalSettingsChange) await p.onExternalSettingsChange(); return 'ok'})()`
  )
  await sleep(300)
}

// Read a vault note's contents from disk (vault-relative path, with .md).
export function readNote(relPath) {
  return readFileSync(join(VAULT_DIR, relPath), 'utf8')
}

export function noteExists(relPath) {
  return existsSync(join(VAULT_DIR, relPath))
}

// Create a note through the app so vault 'create' listeners (auto-template)
// fire exactly as they would for a user-created note.
export async function createNoteViaApp(relPath, content = '') {
  const p = JSON.stringify(relPath)
  await evalRaw(
    `(async()=>{const ex=app.vault.getAbstractFileByPath(${p}); if(ex) await app.vault.delete(ex); ` +
      `await app.vault.create(${p}, ${JSON.stringify(content)}); ` +
      `await new Promise(r=>setTimeout(r,400)); return 'ok'})()`
  )
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
