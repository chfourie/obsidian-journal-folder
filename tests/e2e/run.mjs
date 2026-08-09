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

// E2E entry point. Preflight (Obsidian running, the e2e vault open + responsive,
// plugin loaded), deploy the built bundle, then run every suite. Exit codes:
//   0 = all passed, 1 = test failures, 2 = environment not ready.
//
//   node tests/e2e/run.mjs [--filter <text>] [--list] [--bail] [--no-deploy]

import { execFileSync } from 'node:child_process'
import { evalRaw, evalJSON, VAULT } from './lib/cli.mjs'
import { deployBuild, reloadPlugin, resetVault, sleep } from './lib/vault.mjs'
import { openNote, resetUi } from './lib/page.mjs'
import { runSuites } from './lib/harness.mjs'
import { suites } from './specs/index.mjs'

function parseArgs(argv) {
  const a = { bail: false, list: false, deploy: true }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--filter') a.filter = argv[++i]
    else if (k === '--list') a.list = true
    else if (k === '--bail') a.bail = true
    else if (k === '--no-deploy') a.deploy = false
  }
  return a
}

function fail(msg) {
  console.error(`\x1b[31m${msg}\x1b[0m`)
  process.exit(2)
}

async function preflight(deploy) {
  // 1. CLI present.
  try {
    execFileSync('which', ['obsidian'], { stdio: 'ignore' })
  } catch {
    fail('The `obsidian` CLI is not on PATH. Install Obsidian 1.12.7+ and enable its CLI.')
  }

  // 2. Bring the e2e vault to the front (it must be registered once manually —
  //    see tests/e2e/README.md). `open` is a no-op if it's already focused.
  try {
    execFileSync('open', [`obsidian://open?vault=${encodeURIComponent(VAULT)}`])
  } catch {
    /* `open` is macOS-only; on other platforms focus the window manually. */
  }
  await sleep(1500)

  // 3. Responsiveness — the CLI binds to the focused window and hangs on the
  //    wrong one, so confirm the target answers within the per-call timeout.
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
        `First-time setup: open tests/e2e/jf-e2e-vault in Obsidian once (accept the trust\n` +
        `prompt) so it registers, then re-run. The global CLI toggle must be on.`
    )
  }

  // 4. Deploy the freshly built bundle and reload the plugin.
  if (deploy) {
    deployBuild()
    await reloadPlugin()
  }

  // 5. Plugin actually loaded.
  const loaded = await evalJSON(`!!app.plugins.plugins['journal-folder']`)
  if (!loaded) {
    fail(`The journal-folder plugin is not enabled in the '${VAULT}' vault.`)
  }

  // 5b. The Obsidian window must be VISIBLE (`document.hidden === false`) —
  //     reading-view markdown lazy-renders only when the document is visible,
  //     so a window that is occluded, on another Space, or minimized produces
  //     empty previews (every render assertion then fails in a confusing
  //     cascade). Try to raise it; fail clearly if we can't.
  for (let attempt = 0; attempt < 4; attempt++) {
    const hidden = await evalJSON(`document.hidden === true`)
    if (!hidden) break
    try {
      execFileSync('open', ['-a', 'Obsidian'])
    } catch {
      /* non-macOS */
    }
    await sleep(1000)
    if (attempt === 3) {
      fail(
        'The Obsidian window is not visible (document.hidden) — occluded, on ' +
          'another Space, or minimized. Its reading view will not render. Bring ' +
          'the Obsidian window to the foreground and keep it visible while the ' +
          'suite runs.'
      )
    }
  }

  // 5c. Force the settings dialog to render INSIDE this window. Obsidian's
  //     global "Open settings in a separate window" (`settingsPopoutWindow`,
  //     honoured whenever `canPopoutWindow`) makes `app.setting.open()` spawn a
  //     popout Electron window and mount `app.setting.containerEl` in *that*
  //     window's document — so `document.querySelector` here sees no modal at
  //     all, even though the tab rendered fine. The vault's app.json pins this
  //     to false; re-assert it at runtime so an already-running app that cached
  //     the global `true` is corrected too. Vault config overrides the global,
  //     and writing the value already in app.json is churn-free.
  await evalRaw(
    `(()=>{app.setting.close(); app.vault.setConfig('settingsPopoutWindow', false); return 'ok'})()`
  )

  // 6. Clear any modal/panel a previous run left open, then wait until the
  //    render pipeline is fully warm. After a plugin reload the header can
  //    render before the journal-tasks / signifier post-processors catch up, so
  //    require ALL three surfaces on a known note before starting — otherwise
  //    the first few suites run against a half-warm pipeline (false failures).
  await resetUi()
  const RVH = '.workspace-leaf.mod-active .markdown-reading-view'
  for (let attempt = 0; attempt < 20; attempt++) {
    await openNote('Journal/2026-06-06', 'preview')
    const ready = await evalJSON(
      `(()=>{const rv=document.querySelector('${RVH}'); if(!rv) return false; ` +
        `return !!rv.querySelector('.journal-folder-header') && ` +
        `!!rv.querySelector('[data-jf-task-list="note"]') && ` +
        `!!rv.querySelector('.jf-signifier-gutter');})()`
    )
    if (ready) return
    await sleep(800)
  }
  fail('Plugin loaded but the render pipeline never fully warmed (header/tasks/signifiers).')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.list) {
    console.log(`Obsidian Journal Folder — E2E suite (vault: ${VAULT})`)
    await preflight(args.deploy)
  }
  // Leave fixtures pristine before the first suite even if a prior run aborted.
  resetVault()

  const code = await runSuites(suites, args)
  process.exit(code)
}

main().catch((e) => {
  console.error(`\x1b[31m${e.stack || e.message || e}\x1b[0m`)
  process.exit(2)
})
