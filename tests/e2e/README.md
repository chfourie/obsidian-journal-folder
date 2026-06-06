# End-to-end tests (real Obsidian, via the CLI)

These tests drive the **real plugin in a running Obsidian instance** and assert
on the rendered DOM, vault-file changes, and persisted settings. They cover the
CodeMirror / live-preview / reading-view / theme behaviour that the Vitest unit
suite (jsdom) structurally cannot — see [`docs/agent-notes.md`](../../docs/agent-notes.md).

They are **executable without any AI agent**: a plain Node runner shells out to
the [Obsidian CLI](https://obsidian.md/help/cli) (`obsidian eval` / `dev:dom`),
asserts, and exits non-zero on failure.

## What you need (one-time)

1. **Obsidian 1.12.7+** with the **CLI enabled** — Settings → General → "Command
   line interface" (this writes a global `cli: true`, so it applies to every
   vault). Verify with `which obsidian`.
2. **Register the test vault once.** Open `tests/e2e/jf-e2e-vault/` in Obsidian
   (Open → "Open folder as vault" → accept the trust prompt). This registers it
   under its folder name `jf-e2e-vault`; the runner reuses it thereafter. The
   vault and its fixtures are committed to the repo.
3. Keep that Obsidian window **visible** while the suite runs — not occluded by
   another window, on another macOS Space, or minimized. Obsidian's reading view
   lazy-renders only while `document.hidden === false`, so a non-visible window
   makes every render assertion fail. The runner raises it on macOS and detects
   a non-visible window in preflight, stopping with a clear message rather than
   producing a confusing cascade.

## Running

```bash
npm run test:e2e         # deploy the current build into the vault, then run
npm run test:e2e:build   # build first, then deploy + run
```

Useful flags (pass after `--`, e.g. `npm run test:e2e -- --filter calendar`):

| flag | effect |
|------|--------|
| `--filter <text>` | only suites/tests whose name contains `<text>` |
| `--list` | print the suite/test names without running |
| `--bail` | stop at the first failure |
| `--no-deploy` | skip copying main.js + reloading (use the build already in the vault) |

Exit codes: `0` all passed · `1` test failures · `2` environment not ready.

## How it works

- **Runner** — [`run.mjs`](run.mjs): preflight (CLI present, vault open +
  responsive, plugin loaded, render pipeline warm) → deploy the built bundle →
  run every suite in [`specs/index.mjs`](specs/index.mjs).
- **Isolation by git** — before *every* test the runner closes any open
  modal/panel, runs `git checkout`/`git clean` on `jf-e2e-vault` to restore the
  committed fixtures, and re-applies the suite's settings fixture. So a test that
  writes to a note (status cycle, migration, auto-template) can't leak into the
  next, and `git status tests/e2e/jf-e2e-vault` is clean after a run.
  > ⚠ `resetVault` refuses to run if the vault has no git-tracked files —
  > otherwise `git clean` would delete the fixtures. The vault must be committed
  > (or at least `git add`-ed).
- **Settings fixtures** — each suite declares a `settings` object; the runner
  shallow-merges it over the committed baseline `data.json` and calls the
  plugin's `onExternalSettingsChange()`. Tests can layer further overrides with
  `ctx.applySettings({...})`.
- **Test hooks** — UI elements carry stable `data-jf-*` attributes (and existing
  semantic classes) so selectors survive styling refactors.

## Gotchas (each cost real time)

- **The CLI binds to the *focused* Obsidian window** and an `eval` can **hang**
  on the wrong/busy one. Every call has a hard timeout and retries once after
  re-focusing the vault; keep the test-vault window available.
- **Leftover modals break unrelated tests.** A modal left open sits over the
  reading view; the runner closes all modals/panels before each test, but a spec
  that opens a modal should still dismiss it.
- **Read-after-write races.** Disk writes / debounced saves lag the UI action —
  assert file/settings changes through `ctx.waitFor(() => …)`, not an immediate read.
- **A hidden/minimized window renders nothing.** Obsidian lazy-renders the
  reading view only while `document.hidden === false`; if previews come back
  empty, the window isn't visible.

## Adding a spec

Create `specs/<area>.spec.mjs` exporting a `suite`:

```js
export const suite = {
  name: 'my-area',
  settings: { /* optional overrides on the baseline */ },
  tests: [
    ['does the thing', async (ctx) => {
      await ctx.openNote('Journal/2026-06-06', 'preview')
      ctx.assert.ok(await ctx.exists('.journal-folder-header'), 'header renders')
    }],
  ],
}
```

Then add it to [`specs/index.mjs`](specs/index.mjs). The `ctx` surface
(open/exists/count/text/attr/click/dispatch/openSidebar/readNote/applySettings/
readSettings/waitFor/assert/…) is assembled in [`lib/harness.mjs`](lib/harness.mjs).
See [`TEST-PLAN.md`](TEST-PLAN.md) for the full scenario matrix.
