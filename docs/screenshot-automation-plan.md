# Plan: fully-automated README screenshot regeneration

> **Status: IMPLEMENTED.** Shipped as `npm run screenshots`
> (`scripts/screenshots/{run,scenes}.mjs` + `lib/{capture,demo-vault}.mjs`); see
> [`scripts/screenshots/README.md`](../scripts/screenshots/README.md) and the
> **Screenshots** section of [`docs/agent-notes.md`](agent-notes.md) for the
> as-built harness. This document is retained as the design rationale. The goal —
> regenerate `docs/screenshots/*.png` from **one command** with **zero manual
> vault prep**, reusing the CLI-driving infrastructure the E2E suite proved out —
> was met for all 29 scenes.

## Context — why this

Updating the README screenshots today is repetitive manual work: get the demo
vault into the right state (settings, notes, light mode, plugin reloaded, window
visible, sidebar width, calendar toggled, the right panel/menu open), then run
`scripts/screenshots/regenerate.mjs`. The scene *recipes* are already codified in
`regenerate.mjs`, but the **preconditions and per-scene state are set up by hand**
and drift over time. Building the E2E suite produced exactly the primitives
needed to remove that manual work: deterministic vault state, declarative UI
driving via `data-jf-*` hooks, a window-visibility gate, modal cleanup, settings
fixtures, and read-after-write polling.

## What already exists (reuse, don't rebuild)

- `scripts/screenshots/capture.mjs` — the capture mechanism: `open → set view
  mode → run a setup eval → measure a crop rect → dev:screenshot → sips crop`
  (Retina dpr=2). Has a rich in-page preamble (`RV/Q/QA/rectOf/union/bodyRect/
  click/openMore/ensureCalendar`).
- `scripts/screenshots/regenerate.mjs` — the **scenario manifest**: for each of
  the ~29 PNGs, which note / view mode / UI state / crop region. Already encodes
  the tricky rects (`HEADER_RECT`, `POPOVER_RECT`, `SETTINGS_RECT`, `sidebarRect`,
  `SIDEBAR_OPEN`) and the ordering hack for the session-sticky calendar store.
- `tests/e2e/lib/{cli,page,vault,assert,harness}.mjs` — the E2E primitives:
  `obs()` with timeouts + refocus-retry, `evalRaw/evalJSON`, `openNote`,
  `openSidebar`, `click/setValue/dispatch`, `applySettings/readSettings`,
  `resetUi` (modal/panel cleanup), `resetVault`, `waitFor`, and the
  visibility/readiness preflight in `run.mjs`.

The README screenshots (29): hero-overview; header-{daily,weekly,monthly,
quarterly,yearly,no-folder-title}; more-popover-{daily,weekly,monthly,
yearly-quarters}; calendar-{3-months,from-monthly,with-quarters,mobile};
sidebar-{dynamic,folder-picker,more-menu,tasks-panel}; settings-{signifiers,
tasks-overview,tasks-flow-detail,tasks-status-detail}; signifiers-reading;
task-{category-edit,migration-reading,status-picker}; migration-picker;
plugin-menu.

## Hard-won learnings to bake in (the point of this doc)

**CLI mechanics**
- `obs eval code=<js>`: `app` is in scope; `require('obsidian')` is **not**;
  promises are awaited; results print after `=> `. Args need no shell escaping
  (each is one argv) but **collapse newlines to spaces** and use **no `//`
  comments** in injected code.
- For structured returns, wrap as `Promise.resolve(x).then(JSON.stringify)` —
  `JSON.stringify(promise)` is `"{}"`.
- Every call needs a **hard timeout + one refocus retry**: the CLI binds to the
  focused window and an eval will hang on the wrong/busy one.

**The render pipeline (these caused the worst time sinks)**
- **The window must be visible** — `document.hidden === false`. A window that is
  minimized, **occluded by another window, or on another macOS Space** renders an
  **empty** reading view (lazy-render is gated on visibility). This was the root
  cause of a mystifying "first N captures blank" pattern. Gate on it and fail
  fast.
- **Open notes into a fresh main-area tab** (`getLeaf('tab') + openFile` then set
  `mode`), not by reusing a detached/odd leaf — otherwise the reading view has no
  `.markdown-preview-sizer` and renders nothing.
- After a `plugin:reload`, **detach existing markdown leaves** so the next open
  re-runs the post-processors (stale leaves keep a processor-less preview). Then
  **wait for a readiness probe** (header + tasks block + signifier gutter all
  present) before capturing.

**Determinism**
- Drive UI by **`data-jf-*` hooks** (now shipped across the UI): `data-jf-more-
  button`/`data-jf-more-panel`/`data-jf-calendar-toggle`; calendar `data-jf-nav`,
  `data-jf-picker-trigger`, `data-jf-quick-jump`, `data-jf-cell`/`data-jf-date`;
  sidebar `data-jf-menu-trigger`/`data-jf-menu-panel`/`data-jf-menu-item-title`;
  tasks `data-jf-scope-*`, `data-jf-status-picker`, `data-jf-task-*`,
  `data-jf-migrate-*`; settings `data-jf-settings-tab`/`data-jf-tab-panel`/
  `data-jf-setting="<key>"`/`data-jf-add-{signifier,category}`/`data-jf-editor-
  {save,cancel}`/`.jf-flow-row[data-jf-flow]`/`.jf-breadcrumb-link`.
- Apply a **settings fixture per scene** (write `data.json` → `onExternalSettings
  Change()`), so e.g. the quarters/signifiers/flow shots don't depend on the
  demo vault's current saved settings. Restore afterwards.
- **Clean modals/panels before each scene** (`resetUi`). Portaled custom panels
  survive the focus change `dev:screenshot` causes; **native Obsidian `.menu`
  cannot be captured** (it dismisses) — that's why the plugin menu uses a portaled
  panel, and any new shot must avoid native menus.

**Composition gotchas (already in regenerate.mjs — keep them)**
- **Light mode** for all README shots; **never `Cmd+=` zoom** (collapses the
  in-note calendar from 3 months to 1 → misrepresents the feature).
- **Two header copies** exist in the DOM (active reading view + a hidden
  live-preview one at 0,0) — scope header rects to the active reading view.
- **Calendar visibility is a session-sticky store**; recreate the sidebar leaf to
  reset Svelte panel open-state between scenes.
- Normalise the right-split **sidebar width (~290px)**; multiply CSS-px rects by
  **devicePixelRatio (2)** before `sips`.

## Proposed approach

1. **Extract a shared CLI/driving lib.** Promote `tests/e2e/lib/{cli,page}.mjs`
   (and the visibility/readiness/`resetUi` helpers from `run.mjs`) into a
   vault-parameterised module both the E2E runner and the screenshot harness
   import — single source of truth for `obs/evalRaw/evalJSON/openNote/click/
   setValue/openSidebar/resetUi/waitFor/ensureVisible/deployBuild/reloadPlugin`.
   (Minimal change: today they hardcode `VAULT`; make it a parameter/env.)
2. **Keep the demo vault as the screenshot target** (pristine default theme — the
   README should reflect that), but make each scene **self-setting**:
   - a per-scene optional `settings` fixture applied via `applySettings` against
     the demo vault's `data.json` (back it up + restore at the end, since demo
     `data.json` is git-ignored and user-configured),
   - a per-scene `setup(ctx)` that drives the scene with `data-jf-*` helpers
     (open More, open scope panel, open settings tab + drill into a flow, open the
     migration picker, etc.) instead of bespoke eval blobs.
3. **Add the E2E preflight to the screenshot run**: `ensureVisible` (fail fast if
   `document.hidden`), deploy+reload, detach leaves, readiness probe — so a run
   never silently produces blank/partial PNGs.
4. **Rewrite `regenerate.mjs` as a declarative manifest** over the shared lib:
   ```js
   { name:'more-popover-daily', note:'Personal/2026-05-04', mode:'preview',
     settings:{ quartersEnabled:false },
     setup: (c)=> c.click('[data-jf-more-button]'),
     rect: POPOVER_RECT, pad:14 }
   ```
   The existing rect expressions (`HEADER_RECT`, `POPOVER_RECT`, `SETTINGS_RECT`,
   `sidebarRect`, `CAL_RECT`) carry over verbatim.
5. **One command, idempotent:** `npm run screenshots` → build + deploy to demo →
   preflight → for each scene: resetUi + applySettings + openNote + setup +
   measure + dev:screenshot + sips crop → restore demo `data.json`. A name filter
   (`npm run screenshots header`) and `--list` like the E2E runner.
6. **Optional CI-ish guard:** after regenerating, `git status docs/screenshots`
   shows exactly which shots changed — a quick visual review gate.

## Files

- **New/edited:** a shared `scripts/lib/` (or `tests/e2e/lib` re-exported)
  parameterised by vault; rewritten `scripts/screenshots/regenerate.mjs`
  (declarative manifest) + slimmed `capture.mjs` (delegates measure/crop only);
  `package.json` script `"screenshots"`.
- **Unchanged:** `docs/demo-vault/**` curated notes; `docs/screenshots/*.png`
  outputs; the rect-composition expressions.

## Verification

1. `npm run screenshots --list` enumerates all 29 scenes.
2. `npm run screenshots` on a clean checkout (demo vault open in **light mode**,
   window visible) regenerates every PNG; re-running is idempotent.
3. Force a non-visible window → the run **fails fast** (no blank PNGs).
4. `git status docs/screenshots` clean when nothing visually changed; otherwise
   the diff is reviewable shot-by-shot.
5. Spot-check the tricky ones: `calendar-3-months` (3 months, not 1),
   `more-popover-*` (portaled panel captured), `plugin-menu` (portaled, not a
   native menu), `settings-tasks-*` (correct drill-down level).

## Pointers (so the next session can resume cold)

- E2E harness + all the primitives + traps: `tests/e2e/README.md`,
  `tests/e2e/TEST-PLAN.md`, and the **E2E suite** + **Screenshots** sections of
  `docs/agent-notes.md`.
- Current capture mechanism + scene recipes: `scripts/screenshots/capture.mjs`
  and `scripts/screenshots/regenerate.mjs` (the latter is the de-facto manifest
  to port).
- `data-jf-*` hook inventory: grep `data-jf-` under `src/` (added in the E2E
  commit) — these are the deterministic scene-driving selectors.
