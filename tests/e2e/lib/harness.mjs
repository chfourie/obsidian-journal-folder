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

// The test runner: builds the per-test context (DOM driving + vault + asserts
// + dates), orchestrates each suite (reset fixtures → apply settings → before
// hook → tests), and reports pass/fail with a non-zero exit on any failure.
// Specs are plain data — see tests/e2e/specs/*.spec.mjs — so the suite is fully
// executable without any AI agent.

import * as cli from './cli.mjs'
import * as page from './page.mjs'
import * as vault from './vault.mjs'
import * as dates from './dates.mjs'
import { assert, AssertionError } from './assert.mjs'

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
}

// The context object passed to every test body. One flat surface so specs
// read declaratively: ctx.openNote(...), ctx.text(...), ctx.assert.eq(...).
function makeContext() {
  return {
    // Retained no-ops: specs still carry ctx.step('…') / ctx.shot('Caption',
    // { rect }) annotations from the old verification-report feature (dropped
    // from the repo). They cost nothing and document each scenario's intent.
    step: () => {},
    shot: () => {},
    // CLI / eval
    eval: cli.evalRaw,
    evalJSON: cli.evalJSON,
    command: cli.command,
    // DOM driving
    inPage: page.inPage,
    openNote: page.openNote,
    exists: page.exists,
    count: page.count,
    text: page.text,
    attr: page.attr,
    click: page.click,
    dispatch: page.dispatch,
    setValue: page.setValue,
    openSettings: page.openSettings,
    closeSettings: page.closeSettings,
    openSidebar: page.openSidebar,
    closeSidebar: page.closeSidebar,
    // vault
    resetVault: vault.resetVault,
    vaultStatus: vault.vaultStatus,
    applySettings: vault.applySettings,
    readSettings: vault.readSettings,
    reloadPlugin: vault.reloadPlugin,
    readNote: vault.readNote,
    noteExists: vault.noteExists,
    createNoteViaApp: vault.createNoteViaApp,
    sleep: vault.sleep,
    // dates
    todayDaily: dates.todayDaily,
    dailyOffset: dates.dailyOffset,
    // assertions
    assert,
    // Poll an async predicate until it returns truthy or the timeout elapses.
    // Smooths over read-after-write races (disk writes / debounced saves lag
    // the UI action that triggered them).
    waitFor: async (predicate, { timeout = 4000, interval = 250 } = {}) => {
      const end = Date.now() + timeout
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (await predicate()) return true
        if (Date.now() >= end) return false
        await vault.sleep(interval)
      }
    },
  }
}

// Run the given suites. `opts`: { filter, bail, list }.
export async function runSuites(suites, opts = {}) {
  const ctx = makeContext()
  let passed = 0
  let failed = 0
  const failures = []

  const wanted = (suiteName, testName) =>
    !opts.filter ||
    suiteName.toLowerCase().includes(opts.filter.toLowerCase()) ||
    testName.toLowerCase().includes(opts.filter.toLowerCase())

  for (const suite of suites) {
    const tests = suite.tests.filter(([name]) => wanted(suite.name, name))
    if (tests.length === 0) continue

    if (opts.list) {
      console.log(`${C.bold}${suite.name}${C.reset}`)
      for (const [name] of tests) console.log(`  - ${name}`)
      continue
    }

    console.log(`\n${C.cyan}${C.bold}▸ ${suite.name}${C.reset}`)

    for (const [name, fn] of tests) {
      const started = Date.now()
      try {
        // Close any modal / transient panel a previous test (or run) left
        // open — a stray modal sits over the reading view and breaks unrelated
        // assertions. Then refresh fixtures + settings so a mutating test
        // (status cycle, migration, auto-template) can't leak into the next.
        await page.resetUi()
        vault.resetVault()
        await vault.applySettings(suite.settings || {})
        if (suite.before) await suite.before(ctx)
        await fn(ctx)
        const ms = Date.now() - started
        console.log(`  ${C.green}✓${C.reset} ${name} ${C.dim}(${ms}ms)${C.reset}`)
        passed++
      } catch (e) {
        const ms = Date.now() - started
        failed++
        const where = e instanceof AssertionError ? 'assertion' : 'error'
        console.log(`  ${C.red}✗ ${name}${C.reset}`)
        console.log(`    ${C.red}${where}: ${e.message}${C.reset}`)
        failures.push(`${suite.name} › ${name} — ${e.message}`)
        if (opts.bail) break
      }
    }

    if (suite.after) {
      try {
        await suite.after(ctx)
      } catch (e) {
        console.log(`  ${C.dim}(after hook: ${e.message})${C.reset}`)
      }
    }
    if (opts.bail && failed > 0) break
  }

  // Always leave the app + fixtures pristine: close any lingering modal/panel
  // and restore the committed vault.
  if (!opts.list) {
    try {
      await page.resetUi()
      vault.resetVault()
    } catch {
      /* best effort */
    }
  }

  if (opts.list) return 0

  console.log(
    `\n${failed === 0 ? C.green : C.red}${C.bold}${passed} passed, ${failed} failed${C.reset}`
  )
  if (failures.length) {
    console.log(`\n${C.red}Failures:${C.reset}`)
    for (const f of failures) console.log(`  ${C.red}•${C.reset} ${f}`)
  }
  return failed === 0 ? 0 : 1
}
