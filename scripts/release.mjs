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

// Local release pipeline. Everything that must NOT be skipped before a release
// runs here, in order, halting on the first failure:
//
//   preconditions → lint → unit tests → build → E2E (+verification report)
//   → README screenshots → commit docs → version bump+tag → deploy
//   → commit demo-vault bump → push (branch + tag)
//
// The tag push triggers .github/workflows/release.yml, which creates a DRAFT
// GitHub release (so the final outward step — publishing — stays manual; this is
// what mitigates the risk of the otherwise fully-automated flow).
//
// This pipeline needs a LOCAL, RUNNING, VISIBLE Obsidian (the E2E suite and the
// screenshot harness both drive the real app via the CLI) — it cannot run on CI.
//
//   npm run release -- <patch|minor|major> [--dry-run] [--yes] [--skip-screenshots]
//
//   --dry-run           validate preconditions and print the plan; change nothing
//   --yes               skip the confirm prompt before the outward push
//   --skip-screenshots  skip `npm run screenshots` (the report is never skipped)

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Tracked plugin artifacts that the E2E step (step 3, into jf-e2e-vault) and the
// screenshot step (step 4, into demo-vault) redeploy as verbatim copies of the
// repo's built manifest.json / styles.css. They dirty the working tree as
// EXPECTED churn — and `npm version` (step 6) refuses a dirty tree — so we
// discard them right before it. The demo-vault pair is then re-deployed and
// committed fresh at the new version in step 7; the e2e-vault pair is a fixture
// overwritten at runtime each E2E run, so it simply stays at its committed
// version. This is what kept halting releases with a stale demo-vault manifest.
const DEPLOYED_VAULT_ARTIFACTS = [
  'docs/demo-vault/.obsidian/plugins/journal-folder/manifest.json',
  'docs/demo-vault/.obsidian/plugins/journal-folder/styles.css',
  'tests/e2e/jf-e2e-vault/.obsidian/plugins/journal-folder/manifest.json',
  'tests/e2e/jf-e2e-vault/.obsidian/plugins/journal-folder/styles.css',
]

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

function die(msg) {
  console.error(`${C.red}${C.bold}✗ ${msg}${C.reset}`)
  process.exit(1)
}
function info(msg) {
  console.log(`${C.cyan}${msg}${C.reset}`)
}
function step(n, total, msg) {
  console.log(`\n${C.bold}${C.cyan}[${n}/${total}] ${msg}${C.reset}`)
}

// Run a command, streaming its output. Returns nothing; throws (→ die) on
// failure via stdio inheritance + execFileSync's throw-on-nonzero.
function run(cmd, args, opts = {}) {
  console.log(`${C.dim}$ ${cmd} ${args.join(' ')}${C.reset}`)
  execFileSync(cmd, args, { cwd: REPO_ROOT, stdio: 'inherit', ...opts })
}
// Run a command and capture its stdout (trimmed).
function capture(cmd, args) {
  return execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
}

function parseArgs(argv) {
  const a = { dryRun: false, yes: false, skipScreenshots: false, bump: null }
  for (const k of argv) {
    if (k === '--dry-run') a.dryRun = true
    else if (k === '--yes') a.yes = true
    else if (k === '--skip-screenshots') a.skipScreenshots = true
    else if (['patch', 'minor', 'major'].includes(k)) a.bump = k
    else die(`Unknown argument: ${k}`)
  }
  return a
}

// Compute the next semver for a bump type (no pre-release handling — the
// project never tags pre-releases).
function nextVersion(current, bump) {
  const [maj, min, pat] = current.split('.').map(Number)
  if ([maj, min, pat].some(Number.isNaN)) die(`Unparseable version: ${current}`)
  if (bump === 'major') return `${maj + 1}.0.0`
  if (bump === 'minor') return `${maj}.${min + 1}.0`
  return `${maj}.${min}.${pat + 1}`
}

// CHANGELOG.md must already carry a `## [<version>]` heading — the release
// workflow extracts that section for the GitHub release notes.
function changelogHasSection(version) {
  const text = readFileSync(join(REPO_ROOT, 'CHANGELOG.md'), 'utf8')
  return new RegExp(`^##\\s*\\[${version.replace(/\./g, '\\.')}\\]`, 'm').test(text)
}

function gitClean() {
  return capture('git', ['status', '--porcelain']) === ''
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(`${C.yellow}${question} ${C.reset}`, (ans) => {
      rl.close()
      resolve(/^y(es)?$/i.test(ans.trim()))
    })
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.bump) {
    die('Specify a bump type: npm run release -- <patch|minor|major> [--dry-run] [--yes]')
  }

  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
  const current = pkg.version
  const next = nextVersion(current, args.bump)
  const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD'])

  console.log(`${C.bold}Release ${current} → ${next}${C.reset} (${args.bump}) on branch ${branch}`)

  // --- Preconditions (always checked) -------------------------------------
  step(1, 8, 'Preconditions')
  const clean = gitClean()
  const hasChangelog = changelogHasSection(next)
  const blockers = []
  if (clean) info('✓ clean working tree')
  else blockers.push('Working tree is not clean (`npm version` refuses a dirty tree).')
  if (hasChangelog) info(`✓ CHANGELOG.md has a [${next}] section`)
  else blockers.push(`CHANGELOG.md has no "## [${next}]" section (the release workflow extracts it).`)

  if (args.dryRun) {
    if (blockers.length) {
      console.log(`\n${C.yellow}${C.bold}Blockers (would abort a real run):${C.reset}`)
      blockers.forEach((b) => console.log(`  ${C.yellow}• ${b}${C.reset}`))
    }
    console.log(`\n${C.bold}Dry run — would now:${C.reset}`)
    const plan = [
      'npm run lint',
      'npm test',
      'npm run build',
      'node tests/e2e/run.mjs --report   (live Obsidian → docs/test-reports/)',
      args.skipScreenshots ? null : 'npm run screenshots   (live Obsidian → docs/screenshots/)',
      'git commit docs/test-reports docs/screenshots README.md',
      'git checkout -- <demo-vault + e2e-vault deploy artifacts>   (discard expected churn)',
      `npm version ${args.bump}   (commit + tag ${next})`,
      'npm run deploy',
      `git commit demo-vault bump → "Bump demo-vault plugin to ${next}"`,
      `git push origin ${branch} && git push origin ${next}`,
    ].filter(Boolean)
    plan.forEach((p) => console.log(`  ${C.dim}• ${p}${C.reset}`))
    console.log(`\n${C.green}Then CI creates a DRAFT release for ${next} to review + publish.${C.reset}`)
    return
  }

  if (blockers.length) blockers.forEach((b) => die(b))

  // --- Quality gates ------------------------------------------------------
  step(2, 8, 'Lint + unit tests + build')
  run('npm', ['run', 'lint'])
  run('npm', ['test'])
  run('npm', ['run', 'build'])

  // --- Live E2E with the verification report (must not be skipped) --------
  step(3, 8, 'E2E suite + verification report (live Obsidian)')
  info('Ensure the jf-e2e-vault is open, focused and visible in Obsidian.')
  run('node', ['tests/e2e/run.mjs', '--report'])

  // --- README screenshots (live Obsidian) ---------------------------------
  if (args.skipScreenshots) {
    step(4, 8, 'Screenshots — skipped (--skip-screenshots)')
  } else {
    step(4, 8, 'README screenshots (live Obsidian)')
    info('Ensure the demo-vault is open, focused and visible in Obsidian.')
    run('npm', ['run', 'screenshots'])
  }

  // --- Commit generated documentation -------------------------------------
  step(5, 8, 'Commit verification report + screenshots')
  run('git', ['add', 'docs/test-reports', 'docs/screenshots', 'README.md'])
  if (capture('git', ['diff', '--cached', '--name-only']) === '') {
    info('No documentation changes to commit.')
  } else {
    run('git', ['commit', '-m', `docs: verification report + screenshots for ${next}`])
  }

  // --- Version bump + tag --------------------------------------------------
  step(6, 8, `Version bump → ${next}`)
  // The E2E + screenshot steps redeploy the build into their vaults, dirtying
  // the tracked manifest.json / styles.css copies. That's expected churn, not a
  // source change — discard it so `npm version` (which refuses a dirty tree)
  // proceeds. Step 7 re-deploys + commits the demo-vault pair fresh at ${next}.
  run('git', ['checkout', '--', ...DEPLOYED_VAULT_ARTIFACTS])
  if (!gitClean()) {
    die('Tree dirty after committing docs (unexpected non-artifact changes) — resolve before `npm version`.')
  }
  run('npm', ['version', args.bump])

  // --- Deploy + commit demo-vault artifact bump ----------------------------
  step(7, 8, 'Deploy build + commit demo-vault bump')
  run('npm', ['run', 'deploy'])
  run('git', [
    'add',
    'docs/demo-vault/.obsidian/plugins/journal-folder/manifest.json',
    'docs/demo-vault/.obsidian/plugins/journal-folder/styles.css',
  ])
  if (capture('git', ['diff', '--cached', '--name-only']) === '') {
    info('No demo-vault artifact changes to commit.')
  } else {
    run('git', ['commit', '-m', `Bump demo-vault plugin to ${next}`])
  }

  // --- Push (the one outward, hard-to-reverse step) ------------------------
  step(8, 8, 'Push branch + tag')
  if (!args.yes) {
    const ok = await confirm(
      `Push ${branch} and tag ${next} to origin? This triggers a DRAFT GitHub release. [y/N]`
    )
    if (!ok) {
      console.log(
        `${C.yellow}Stopped before push. Local commits + tag ${next} are in place; ` +
          `push manually when ready:${C.reset}\n` +
          `  git push origin ${branch} && git push origin ${next}`
      )
      return
    }
  }
  run('git', ['push', 'origin', branch])
  run('git', ['push', 'origin', next])

  console.log(
    `\n${C.green}${C.bold}✓ Released ${next}.${C.reset}\n` +
      `CI is building a DRAFT GitHub release. Review it, then publish:\n` +
      `  gh release edit ${next} --draft=false`
  )
}

main().catch((e) => die(e.message || String(e)))
