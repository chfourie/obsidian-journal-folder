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

// Pure data model + markdown renderer for the release verification report.
//
// The model holds NO I/O — it only accumulates suites → tests → ordered step /
// screenshot entries and renders them to a single markdown document. The
// screenshot files themselves are captured by `reporter.mjs` (the I/O wrapper);
// the model just records their committed relative paths. Keeping this pure means
// the whole report shape is unit-testable in jsdom/vitest without a live
// Obsidian instance (see tests/e2e/report.test.ts).

// Slugify a human label into a filesystem- and anchor-safe token.
export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// The committed relative path (from docs/test-reports/) for a screenshot, e.g.
// `assets/calendar/03-multi-month-grid.png`. Stable + ordered so a re-run
// overwrites the same files instead of accumulating orphans.
export function shotRelPath(suiteName, index, caption) {
  const n = String(index).padStart(2, '0')
  return `assets/${slug(suiteName)}/${n}-${slug(caption)}.png`
}

const STATUS_ICON = { passed: '✓', failed: '✗', skipped: '⊘' }

export class ReportModel {
  // meta: { version, obsidian, date, command } — all optional, rendered in the
  // header table. Provided by the runner (run.mjs) at construction time.
  constructor(meta = {}) {
    this.meta = meta
    this.suites = []
    this._suite = null
    this._test = null
    this._shotCount = 0
  }

  beginSuite(name, description = '') {
    this._suite = { name, description, tests: [] }
    this.suites.push(this._suite)
    return this._suite
  }

  beginTest(name) {
    if (!this._suite) throw new Error('beginTest called before beginSuite')
    this._test = { name, status: 'passed', ms: 0, error: null, entries: [] }
    this._suite.tests.push(this._test)
    return this._test
  }

  // Record a narrative step in the current test.
  step(text) {
    if (!this._test) throw new Error('step called before beginTest')
    this._test.entries.push({ type: 'step', text: String(text) })
  }

  // Record a screenshot in the current test. `path` is the committed relative
  // path under docs/test-reports/ (see shotRelPath). Returns the entry.
  shot(caption, path) {
    if (!this._test) throw new Error('shot called before beginTest')
    const entry = { type: 'shot', caption: String(caption), path }
    this._test.entries.push(entry)
    this._shotCount++
    return entry
  }

  // The 1-based index of the next screenshot within the current suite — used to
  // build a stable, ordered file name before the file is captured.
  nextShotIndex() {
    if (!this._suite) throw new Error('nextShotIndex called before beginSuite')
    return this._suite.tests.reduce(
      (n, t) => n + t.entries.filter((e) => e.type === 'shot').length,
      0
    ) + 1
  }

  endTest(status, error = null, ms = 0) {
    if (!this._test) throw new Error('endTest called before beginTest')
    this._test.status = status
    this._test.error = error ? String(error) : null
    this._test.ms = ms
    this._test = null
  }

  // Aggregate pass/fail/shot counters across the whole run.
  stats() {
    let passed = 0
    let failed = 0
    let shots = 0
    for (const suite of this.suites) {
      for (const test of suite.tests) {
        if (test.status === 'failed') failed++
        else if (test.status === 'passed') passed++
        for (const e of test.entries) if (e.type === 'shot') shots++
      }
    }
    return { suites: this.suites.length, passed, failed, shots, ok: failed === 0 }
  }

  // Render the whole report as a single markdown document.
  toMarkdown() {
    const s = this.stats()
    const lines = []
    lines.push('# Journal Folder — Release Verification Report')
    lines.push('')
    lines.push(
      '> Generated automatically by the end-to-end test suite while preparing a ' +
        'release. Every scenario below was executed against a **live Obsidian ' +
        'instance**, and the screenshots were captured from that same run. It is ' +
        'both the evidence of what was verified and a guided tour of the plugin in ' +
        'action.'
    )
    lines.push('')

    // Header summary table.
    const result = s.ok
      ? `✅ ${s.passed} passed`
      : `❌ ${s.passed} passed, ${s.failed} failed`
    lines.push('| | |')
    lines.push('| --- | --- |')
    if (this.meta.version) lines.push(`| **Plugin version** | ${this.meta.version} |`)
    if (this.meta.obsidian) lines.push(`| **Obsidian** | ${this.meta.obsidian} |`)
    if (this.meta.date) lines.push(`| **Generated** | ${this.meta.date} |`)
    lines.push(`| **Suites** | ${s.suites} |`)
    lines.push(`| **Result** | ${result} |`)
    lines.push(`| **Screenshots** | ${s.shots} |`)
    lines.push('')

    // Contents.
    lines.push('## Contents')
    lines.push('')
    for (const suite of this.suites) {
      const sub = suite.tests.filter((t) => t.status === 'failed').length
      const tag = sub ? ` — ${sub} failed` : ''
      lines.push(`- [${suite.name}](#${slug(suite.name)})${tag}`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')

    // Suites.
    for (const suite of this.suites) {
      lines.push(`## ${suite.name}`)
      lines.push('')
      if (suite.description) {
        lines.push(suite.description)
        lines.push('')
      }
      for (const test of suite.tests) {
        const icon = STATUS_ICON[test.status] || '?'
        const ms = test.ms ? ` _(${test.ms}ms)_` : ''
        lines.push(`### ${icon} ${test.name}${ms}`)
        lines.push('')
        const steps = test.entries.filter((e) => e.type === 'step')
        const shots = test.entries.filter((e) => e.type === 'shot')
        // Steps as an ordered list (narrative of what the scenario did).
        if (steps.length) {
          let i = 1
          for (const e of test.entries) {
            if (e.type === 'step') lines.push(`${i++}. ${e.text}`)
          }
          lines.push('')
        }
        // Screenshots after the narrative (gallery for the scenario).
        for (const e of shots) {
          lines.push(`![${e.caption}](${e.path})`)
          lines.push('')
          lines.push(`*${e.caption}*`)
          lines.push('')
        }
        if (test.status === 'failed' && test.error) {
          lines.push('> **Failure:**')
          lines.push('>')
          for (const ln of test.error.split('\n')) lines.push(`> ${ln}`)
          lines.push('')
        }
      }
      lines.push('---')
      lines.push('')
    }

    lines.push(
      '<sub>Regenerate with `npm run release` (full pipeline) or ' +
        '`npm run test:e2e -- --report`. Do not edit by hand — it is overwritten ' +
        'on every release.</sub>'
    )
    lines.push('')
    return lines.join('\n')
  }
}
