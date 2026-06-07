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

import { describe, it, expect } from 'vitest'
// The report model is plain ESM JS shared with the (node-run) e2e harness.
import { ReportModel, slug, shotRelPath } from './lib/report.mjs'

describe('slug', () => {
  it('lowercases and hyphenates', () => {
    expect(slug('Multi Month Grid')).toBe('multi-month-grid')
  })
  it('strips leading/trailing separators and punctuation', () => {
    expect(slug('  Today’s note! ')).toBe('today-s-note')
  })
  it('caps length', () => {
    expect(slug('a'.repeat(100)).length).toBe(60)
  })
})

describe('shotRelPath', () => {
  it('builds an ordered, slugged path under assets/<suite>/', () => {
    expect(shotRelPath('calendar', 3, 'Multi-month grid')).toBe(
      'assets/calendar/03-multi-month-grid.png'
    )
  })
  it('zero-pads the index to two digits', () => {
    expect(shotRelPath('tasks', 12, 'x')).toBe('assets/tasks/12-x.png')
  })
})

describe('ReportModel', () => {
  function sample() {
    const m = new ReportModel({ version: '9.9.9', obsidian: '1.12.7', date: '2026-06-07' })
    m.beginSuite('calendar', 'The in-note month picker.')
    m.beginTest('renders a multi-month grid')
    m.step('Open the monthly note')
    m.shot('Three-month grid', 'assets/calendar/01-three-month-grid.png')
    m.endTest('passed', null, 123)
    m.beginTest('navigates to today')
    m.step('Click Current')
    m.endTest('failed', 'AssertionError: expected 2026-06', 50)
    return m
  }

  it('tracks the next shot index per suite', () => {
    const m = new ReportModel()
    m.beginSuite('s')
    m.beginTest('t')
    expect(m.nextShotIndex()).toBe(1)
    m.shot('a', 'assets/s/01-a.png')
    expect(m.nextShotIndex()).toBe(2)
  })

  it('aggregates pass/fail/shot stats', () => {
    const s = sample().stats()
    expect(s).toMatchObject({ suites: 1, passed: 1, failed: 1, shots: 1, ok: false })
  })

  it('renders the header table, contents and per-suite sections', () => {
    const md = sample().toMarkdown()
    expect(md).toContain('# Journal Folder — Release Verification Report')
    expect(md).toContain('| **Plugin version** | 9.9.9 |')
    expect(md).toContain('| **Obsidian** | 1.12.7 |')
    expect(md).toContain('## Contents')
    expect(md).toContain('- [calendar](#calendar) — 1 failed')
    expect(md).toContain('## calendar')
    expect(md).toContain('The in-note month picker.')
  })

  it('renders steps as an ordered list and shots as captioned images', () => {
    const md = sample().toMarkdown()
    expect(md).toContain('### ✓ renders a multi-month grid')
    expect(md).toContain('1. Open the monthly note')
    expect(md).toContain('![Three-month grid](assets/calendar/01-three-month-grid.png)')
    expect(md).toContain('*Three-month grid*')
  })

  it('renders a failure block for failed tests', () => {
    const md = sample().toMarkdown()
    expect(md).toContain('### ✗ navigates to today')
    expect(md).toContain('> **Failure:**')
    expect(md).toContain('> AssertionError: expected 2026-06')
  })

  it('reports ok=true and a green result when nothing failed', () => {
    const m = new ReportModel()
    m.beginSuite('smoke')
    m.beginTest('loads')
    m.endTest('passed', null, 1)
    expect(m.stats().ok).toBe(true)
    expect(m.toMarkdown()).toContain('✅ 1 passed')
  })

  it('guards against out-of-order calls', () => {
    const m = new ReportModel()
    expect(() => m.beginTest('x')).toThrow(/beginSuite/)
    m.beginSuite('s')
    expect(() => m.step('x')).toThrow(/beginTest/)
  })
})
