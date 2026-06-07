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

// The I/O side of the release report: binds the pure ReportModel to real
// screenshot capture (reusing the screenshots harness' measure→shot→crop
// plumbing) and writes the committed markdown + PNG assets under
// docs/test-reports/. Only ever constructed when the suite runs with --report
// (the release pipeline); a normal `npm run test:e2e` passes a null reporter so
// ctx.step/ctx.shot are no-ops and nothing is captured.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { ReportModel, shotRelPath } from './report.mjs'
import {
  measureRect,
  screenshotFull,
  cropFrom,
  decorateShot,
} from '../../../scripts/screenshots/lib/capture.mjs'
import { REPO_ROOT, sleep } from './vault.mjs'

// Where the committed report + its assets live (referenced from the README).
export const REPORT_DIR = join(REPO_ROOT, 'docs/test-reports')
export const REPORT_FILE = join(REPORT_DIR, 'README.md')
export const ASSETS_DIR = join(REPORT_DIR, 'assets')

// Default crop: the active reading view (falls back to the active leaf, then
// <body>). Returns {x,y,w,h}; evaluated in-page with the capture preamble in
// scope, so `_r` is available.
const DEFAULT_SHOT_EXPR =
  "_r(document.querySelector('.workspace-leaf.mod-active .markdown-reading-view')" +
  "||document.querySelector('.workspace-leaf.mod-active')||document.body)"

// A no-op reporter used when capture is disabled — keeps spec code uniform
// (ctx.step / ctx.shot always exist) without doing any work.
export const nullReporter = {
  enabled: false,
  beginSuite() {},
  beginTest() {},
  endTest() {},
  step() {},
  async shot() {},
  write() {},
  model: null,
}

export function createReporter(meta = {}) {
  const model = new ReportModel(meta)
  // Full-window frames are large + machine-local — stage them in the OS temp
  // dir and crop into the committed assets, mirroring the screenshots harness.
  const frameDir = join(tmpdir(), 'jf-report-frames')
  // Start from a clean assets tree so a removed/renamed shot can't linger.
  rmSync(ASSETS_DIR, { recursive: true, force: true })
  mkdirSync(ASSETS_DIR, { recursive: true })
  mkdirSync(frameDir, { recursive: true })

  let frameSeq = 0

  return {
    enabled: true,
    model,

    beginSuite(name, description) {
      model.beginSuite(name, description)
    },
    beginTest(name) {
      model.beginTest(name)
    },
    endTest(status, error, ms) {
      model.endTest(status, error, ms)
    },
    step(text) {
      model.step(text)
    },

    // Capture a screenshot for the current scenario.
    //   caption  — human label, also the file slug + report caption
    //   opts.rect — a measure expression (string) returning {x,y,w,h}; defaults
    //               to the active reading view. Pass opts.full to grab the whole
    //               window. opts.pad overrides the crop padding.
    async shot(caption, opts = {}) {
      const suiteName = model._suite?.name || 'misc'
      const index = model.nextShotIndex()
      const rel = shotRelPath(suiteName, index, caption)
      const outPath = join(REPORT_DIR, rel)
      mkdirSync(dirname(outPath), { recursive: true })
      const framePath = join(frameDir, `frame-${frameSeq++}.png`)
      try {
        await screenshotFull(framePath)
        // `dev:screenshot` briefly changes window focus; let the window settle
        // so the next test's first eval doesn't race a repaint (empty stdout).
        await sleep(250)
        if (opts.full) {
          // No crop — copy the frame across via a trivial full-bleed rect.
          const rect = await measureRect('_r(document.body)')
          cropFrom(framePath, outPath, rect, 0)
        } else {
          const rect = await measureRect(opts.rect || DEFAULT_SHOT_EXPR)
          cropFrom(framePath, outPath, rect, opts.pad ?? 14)
        }
        // Frame the crop (drop shadow / border) so it stands out from the page.
        decorateShot(outPath)
        model.shot(caption, rel)
        return rel
      } catch (e) {
        // A failed capture must never fail the test — record it as a step.
        model.step(`⚠️ screenshot "${caption}" failed: ${e.message}`)
        return null
      }
    },

    // Render + write the committed report. Returns the file path.
    write() {
      mkdirSync(REPORT_DIR, { recursive: true })
      writeFileSync(REPORT_FILE, model.toMarkdown(), 'utf8')
      return REPORT_FILE
    },
  }
}
