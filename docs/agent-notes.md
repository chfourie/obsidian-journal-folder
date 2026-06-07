# Agent & contributor working notes

Hard-won, non-obvious knowledge about working in this repo that isn't derivable
from the code itself — working conventions the maintainer expects, how to verify
behaviour in real Obsidian, the vault topology, Obsidian styling traps, the
release flow, and design decisions behind shipped features.

> **For AI agents (Claude Code etc.):** this file is the canonical, git-tracked
> home for the kind of thing you'd otherwise keep in private session memory.
> Read it at the start of non-trivial work, and **when you learn something
> durable, add it here** (in the same change) rather than only in ephemeral
> memory — memory outside the repo isn't shared and can be lost.

---

## Working conventions the maintainer expects

- **Always write tests with functionality.** Any non-trivial code change adds or
  updates tests in `tests/` in the *same* change — no code-only changes. Pure
  refactors can lean on the existing suite, but a changed public surface needs
  new tests. Trivial edits (typos, comments, config bumps) don't. Reuse the
  `tests/mocks/obsidian.ts` mock and `tests/helpers/fixtures.ts` fixtures. Run
  `npm test` before reporting work done.
  - **Live Obsidian/CLI verification supplements automated tests — it never
    replaces them.** The CLI (see below) is the only way to exercise CodeMirror /
    live-preview / DOM / theme behaviour that jsdom can't, so use it to *confirm*
    the wiring end-to-end. But every new feature and behaviour change still gets
    unit tests for its logic in the same change — factor the pure decision logic
    out (as `task-range-cap.ts`, `reference-range.ts`, `build-task-model.ts` do)
    so it's testable even when the surrounding surface is DOM-bound. Don't report
    work done on the strength of a CLI screenshot alone.
- **Prefer robust / theme-stable solutions over pixel-perfect cosmetics, and
  surface the tradeoffs before implementing.** The maintainer explicitly dislikes
  "works on my setup, breaks on yours" fragility. Reach for solutions that
  inherit native/theme behaviour over ones that re-measure or hard-code geometry;
  they will knowingly accept a minor cosmetic offset to avoid a fragile code
  path. For theme/layout-affecting changes, present the robustness tradeoffs and
  let them decide. (The per-flow **Theme-checkbox** rendering is the accepted
  escape hatch for unusual themes; task rows keep native `list-item` flow, never
  grid/flex.)
- **Don't drive Obsidian + screenshot to iterate on UI layout.** When asked to
  "match the styling of X", read X's source first — how it extends Obsidian base
  classes and which CSS classes it picks up — and apply the same Obsidian-native
  classes, rather than fighting widths/padding with custom CSS or
  reload-and-screenshot loops. (The per-folder config modal was a one-line
  `mod-settings` / `vertical-tab-content` fix, visible purely from reading the
  settings-tab source.) Reserve screenshots for README updates or genuinely
  theme-specific rendering you can't reason about from code.
- **Toggle labels show the *current* state, not the action.** For inline link/
  button toggles, render the label from the current value (`tasksSidebarReference
  === 'today'` → "Today"; completed filter → "All tasks" vs "Active tasks"). Pair
  with `aria-pressed` reflecting the current state. This intentionally overrides
  the older `docs/tasks-design.md` "labels describe the action" line.
- **"Themable" / "theme default colour" means *CSS variables*, not delegating to
  Obsidian's link-resolution pass.** The plugin makes the accent-vs-normal call
  itself and reads colours from theme tokens. Calendar specifics: missing day
  cells (`.journal-folder-calendar-cell.missing`) lock colour to `--text-normal
  !important` to defeat any theme's `a.internal-link.is-unresolved` recolour
  (opacity from `is-unresolved` may still come through — no `!important` on
  opacity); existing cells and Sundays get `--text-accent !important`. Because the
  base needs `!important` (theme rules out of our control), every override needs
  `!important` too. This rule is calendar-specific; other UI can use ordinary
  specificity.
- **Update the demo vault (and deploy targets) after every source/style change.**
  Run `npm run deploy` (build + copy `main.js` / `styles.css` / `manifest.json`
  into the demo vault and every configured target). The demo-vault plugin is a
  built copy, not a symlink, so it silently lags source until synced. Never copy
  `data.json` (vault-local state). Skip only for docs-only / test-only / README
  edits that don't change bundled output.

---

## Vault topology

- **Demo vault** — `docs/demo-vault/` — a **pristine, vanilla** vault: default
  theme, **zero CSS snippets**. It is the screenshot/repro target. Its plugin
  `data.json` is git-ignored and configured (signifiers `important` /
  `inspiration` / `explore`, `margin-column` placement). Reachable from the CLI
  as `vault="demo-vault"`.
- **Real deploy targets** (the maintainer's actual journals, listed in the
  git-ignored `deploy-targets.json`):
  - `/Users/ChFourie/Obsidian/Journal/Journal 2026` — CLI name `"Journal 2026"`
  - `/Users/ChFourie/Obsidian/Momentum/Momentum 2026` — CLI name `"Momentum 2026"`
    (uses the **AnuPpuccin** theme)
  Both run ~7 enabled CSS snippets (custom-widths, dashboard, rounded-checkboxes,
  hide-inline-title, …) and both have the Hot-Reload plugin, so `npm run deploy` /
  `npm run push` reload them automatically.
- **Why it matters:** CSS that relies on absolute positioning / geometry can look
  perfect in the demo vault yet break in the real vaults, because snippets/themes
  restyle bullets, checkboxes, indentation guides, and widths. This exact trap had
  signifier icons overlapping the checkbox in the real vaults while rendering fine
  in the demo. **Prefer flow-based rendering over absolute positioning**; treat
  the demo vault as capable of false positives and verify layout in the real
  vaults.

---

## Verifying behaviour in real Obsidian

CodeMirror **live-preview** behaviour (editor extensions, checkbox/marker clicks,
gutter positioning) **cannot be reproduced in Vitest/jsdom** — drive the real app.

### The Obsidian CLI (preferred tool)

Obsidian ships a CLI (<https://obsidian.md/help/cli>); drive it directly for
fault-finding and screenshots instead of asking the maintainer for `outerHTML`.

- **Requirements:** Obsidian **1.12.7+**, the **Settings → General → "Command
  line interface"** toggle enabled *in the target vault*, and the app running
  (`which obsidian` → `/usr/local/bin/obsidian`).
- **Run with the sandbox OFF** (`dangerouslyDisableSandbox: true`) — the CLI uses
  a local IPC socket the sandbox blocks (symptom: "The CLI is unable to find
  Obsidian…"; `pgrep` also fails under the sandbox).
- **Invocation:** `obsidian [vault=<name>] <command> [param=value] [flag]` (quote
  values with spaces).
- **⚠ Confirm the vault first — recurring mistake.** The repo ROOT
  (`/Users/ChFourie/Projects/Personal/obsidian-journal-folder`) sometimes gets
  opened as a vault named **`obsidian-journal-folder`** — it is NOT the demo
  vault, has no signifiers/config, and isn't a deploy target (stale build). The
  bare `obsidian <command>` targets whatever vault is **focused**, which is often
  that repo-root vault. **ALWAYS pass `vault="demo-vault"` explicitly** (the demo
  vault's registered CLI name is its folder basename, `demo-vault`) AND verify
  with `vault="demo-vault" eval code="app.vault.getName()"` → `demo-vault` before
  trusting any result. The demo vault's CLI dev toggle **is enabled** — if `eval`
  reports "not found", you're almost certainly hitting the wrong vault, not a
  disabled toggle, so re-target before assuming the toggle is off.
- **Listing registered vaults:** `~/Library/Application Support/obsidian/obsidian.json`
  maps vault id → `{path, ts, open}`. Use it to find the demo vault's path
  (`…/docs/demo-vault`, name `demo-vault`) and which vaults are currently open.
- **Don't use `app:reload`.** It reloads the whole app, momentarily makes `eval`
  unavailable, and churns the repo-root vault's `.obsidian/workspace.json` (and
  per the CLI notes leaves the code-block processor unregistered). The demo
  vault's committed `.hotreload` already reloads the plugin after `npm run push`;
  to force it use `plugin:reload id=journal-folder`. Reload the plugin's settings
  after editing its (gitignored) `data.json` with
  `eval code="app.plugins.plugins['journal-folder'].onExternalSettingsChange()"`.
- **Verifying a vault-data change cleans up after itself.** Opening notes / editing
  files via the app can leave incidental churn in tracked demo-vault notes (e.g. a
  task status rewritten) and `.obsidian/workspace.json`. After a live verification,
  `git status` the repo and `git checkout --` any file you didn't deliberately
  change; back up any note you temporarily edit (`cp … /tmp/claude/…`) and restore
  it. `data.json` is gitignored, but still revert experimental settings you added.
- The dev commands (`eval` / `dev:dom` / `dev:screenshot`) are **gated per-vault**
  by that General toggle. `Error: Command "eval" not found. It may require a
  plugin to be enabled.` means the toggle is off in *that* vault **or** (more
  often) you're targeting the wrong vault — confirm the target before concluding
  the toggle is off (you can't toggle it via `eval`, since `eval` is what's
  unavailable).

**Most useful commands:**

- `eval code=<js>` — run JS in the app and return the result. `app` is in scope;
  `require('obsidian')` is **not** (use `app.*`). Promises are awaited. Plugin
  instance: `app.plugins.plugins['journal-folder']`. Use for live geometry
  (`getBoundingClientRect`, `getComputedStyle`, ancestor overflow chains), marker
  `style.left`, etc.
- `dev:dom selector=<css>` — query live DOM (text / innerHTML / attributes).
- `dev:screenshot [path=<file>]` — capture the window (see Screenshots below).
- `open file=<name> [newtab]`, `daily`, `read`, `outline format=json`.
- `command id=<id>` / `commands [filter=]` — run/list command IDs.
- `dev:mobile on|off` (mobile emulation), `dev:console` / `dev:errors` (captured
  logs), `dev:cdp method= params=` (raw CDP), `dev:css selector= prop=`, `tasks`.
- `plugin:reload id=journal-folder` — reload the plugin after `npm run push`
  (preferred over `app:reload`, which leaves the markdown code-block processor
  unregistered so the header renders as raw `<pre>`). *Note: `plugin:reload` and
  `app:reload` are themselves gated and may report "not found" in some vaults —
  the Hot-Reload plugin covers reloads after a deploy regardless.*

**Two CLI gotchas (each cost time):**

- `create file=<name>` **ignores the name** and writes `Untitled.md`. To make a
  named scratch note, write it straight to disk (`docs/demo-vault/<name>.md`),
  wait ~1s for Obsidian to index, then `open file=<name>`. Clean it up after.
- **Force a leaf into editing/live-preview** (the demo default view is `preview`/
  reading) to inspect CodeMirror DOM:
  ```js
  eval code="(async()=>{const v=app.workspace.getLeaf(false).view;await v.setState({...v.getState(),mode:'source'},{});await new Promise(r=>setTimeout(r,500));return [...document.querySelectorAll('.jf-signifier-gutter')].length})()"
  ```
  A synthetic `el.dispatchEvent(new MouseEvent('mousedown'|'click',{bubbles:true,clientX,clientY}))` fires the real handlers (CM `domEventHandlers`, Svelte) — e.g. mousedown on a `.jf-signifier-gutter.jf-signifier-live` opens the picker modal — so behaviour can be verified end-to-end without a human.

### Without the CLI

- Launch: `open -a Obsidian` (needs the sandbox off — LaunchServices `procNotFound`
  otherwise). Open a note: `open "obsidian://open?path=<url-encoded-abs-path>"`.
- The demo vault has a committed `.hotreload` marker, so after `npm run build` +
  copying `main.js` in, the plugin auto-reloads — no restart.
- To log without a console, have the plugin
  `app.vault.adapter.append('.obsidian/<file>.log', …)` — write **under
  `.obsidian/`**, never a normal vault path (that triggers the file watcher and
  can revert open-editor buffers). Never `JSON.stringify` a `TFile` (circular).

---

## E2E suite (live Obsidian, via the CLI)

`tests/e2e/` is an **agent-independent** end-to-end suite that drives the real
plugin in a running Obsidian instance through the CLI and asserts on rendered
DOM, vault-file changes, and settings — the live counterpart to the jsdom unit
suite. Run `npm run test:e2e:build`; full docs in
[`tests/e2e/README.md`](tests/e2e/README.md) and the scenario matrix in
[`tests/e2e/TEST-PLAN.md`](tests/e2e/TEST-PLAN.md).

- **Committed test vault** `tests/e2e/jf-e2e-vault/` — open it once manually to
  register it (trust prompt); thereafter the runner reverts it with git between
  tests. `main.js`/`workspace*.json` are gitignored; `data.json` is force-tracked
  (baseline settings). Stable `data-jf-*` attributes on the UI are the selectors.
- **Isolation = git.** Before every test the runner closes open modals/panels,
  `git checkout`/`clean`s the vault, and re-applies the suite's settings.
  `resetVault` refuses to run on an untracked vault (else `git clean` would delete
  the fixtures), so the vault must be committed/staged.
- **Three traps that cost real time** (all now handled in the harness, keep them
  in mind when extending):
  1. **The CLI binds to the *focused* window** and `eval` hangs on the wrong/busy
     one → every call has a timeout + one refocus-retry; keep the vault window
     reachable.
  2. **Leftover modals break unrelated tests** — a modal left open sits over the
     reading view and fails every subsequent render assertion (looked like a
     mysterious "first N suites fail then recover" cascade). The harness closes
     all modals/panels before each test; a spec that opens one should still
     dismiss it.
  3. **Read-after-write races** — disk writes / debounced saves lag the UI action;
     assert via `ctx.waitFor(() => …)`, never an immediate read. Also: the plugin
     keeps settings in a private field, so read them back from `data.json`
     (`ctx.readSettings()`), not off the plugin instance.
  4. **A non-visible Obsidian window renders nothing** — the reading view
     lazy-renders only while `document.hidden === false`, so empty previews mean
     the window is occluded / on another Space / minimized (NOT necessarily
     minimized — a fully-covered window also reports hidden). This was the real
     cause of the "early suites fail then recover" cascade; the runner's
     preflight now fails fast on it. Settings editing goes through
     `data-jf-setting="<key>"` hooks on each field's `.setting-item`.
- **`evalJSON` must resolve before stringify** — `JSON.stringify(promise)` is
  `"{}"`; the helper wraps as `Promise.resolve(x).then(JSON.stringify)` so the CLI
  awaits first.
- **The fixtures are date-pinned to 2026-06-06 — date-sensitive tests rot by the
  day.** The vault's "today" is `2026-06-06` (the daily note, the nav assertions).
  The sidebar **task panel** is the fragile spot: its baseline scope is
  `tasksSidebarAnchor: today` + `range: day`, so on any *other* real date a
  *daily*-note fixture's tasks drop out of scope (a monthly/yearly note whose
  period still contains the wall-clock day takes over — e.g. on 2026-06-07 the
  panel showed only `Journal/2026-06.md`'s task). Symptom: the category-section,
  truncation-footer, and sidebar-row task tests fail while the scope-independent
  sidebar tests pass. Fix already applied to those three: `applySettings({
  tasksSidebarAnchor: 'note' })` so they scope to the *opened* note, not the
  clock, plus `ctx.waitFor` around the cache-populated assertion. When adding a
  task-panel test, anchor on the note (or set an explicit range) unless you are
  specifically testing the `today` anchor on the fixture date.

---

## Screenshots

- **Always capture from a live Obsidian session against the demo vault** — never
  a mock harness (a previous Playwright harness drifted from the real Svelte
  output and was deleted).
- **Don't `Cmd+=` zoom** Obsidian "for readability" — it narrows the pane, trips
  `pickVisibleMonthCount`, and collapses the in-note calendar from 3 months to 1,
  misrepresenting the feature. Treat zoom as fixed at 0. For larger captures hide
  the sidebars or widen the window instead.
- **One idempotent command, zero manual prep.** `npm run screenshots` regenerates
  all 29 PNGs (filter: `npm run screenshots -- header`; list: `-- --list`; reuse
  the built bundle: `-- --no-deploy`; re-cut crops only: `-- --recrop`). The
  harness lives in `scripts/screenshots/`: `run.mjs` (preflight + per-scene loop +
  restore), `scenes.mjs` (the declarative manifest — one self-setting entry per
  PNG), and `lib/{capture,demo-vault}.mjs`. It **reuses the E2E CLI/DOM plumbing**
  (`tests/e2e/lib/{cli,page}.mjs`, pointed at the demo vault via
  `JF_E2E_VAULT=demo-vault`) and the E2E **preflight** (verify
  `getName()==='demo-vault'` → build/deploy → reload → detach leaves → visibility
  gate → force light mode → readiness probe). Run **sandbox-off**; demo vault open
  + visible. See `scripts/screenshots/README.md`.
- **Each scene is self-setting.** A scene may carry a `settings` fixture
  (shallow-merged over the demo `data.json`, which is **backed up and restored**
  around the run — it's gitignored + user-configured), `tempFiles` (a throwaway
  title-less journal folder for `header-no-folder-title`), `mobile: true`
  (`dev:mobile on` for `calendar-mobile`), and a `setup(ctx)` that drives the UI
  through the shipped `data-jf-*` hooks. The base scheme is forced to light and
  restored; temp files / mobile are torn down. After a run the demo vault is
  pristine (`data.json`, tracked notes, `workspace.json` all unchanged).
- **Capture is two phases: drive then crop.** The drive measures the rect, saves
  the **full-window frame** + a **sidecar rect** under
  `scripts/screenshots/.captures/` (gitignored), then `sips`-crops. `--recrop`
  re-cuts from the saved frames with no Obsidian — so a wrong crop / changed `pad`
  is fixed instantly, and a blank crop is diagnosed by opening the saved frame to
  see the real app state. (This caught both positioning bugs below at a glance.)
- Harness gotchas:
  - **Two header copies** in the active leaf (reading view + a hidden live-preview
    one at 0,0). A bare `.mod-active [data-jf-more-button]` hits the **hidden** one
    → its popover renders blank at the top-left. Scope interactive reading-view
    queries to `.markdown-reading-view`.
  - **Portaled panels position via `requestAnimationFrame`**, which is throttled
    while Obsidian isn't the foreground app during CLI driving → a freshly opened
    sidebar menu stays at its default top-left (the `menu-panel-position.ts`
    no-anchor "centered sheet"). Fire a window `resize` after opening to run the
    reposition synchronously.
  - Native Obsidian `Menu` (`.menu`) **can't be captured** (dismisses on the
    `dev:screenshot` focus change — the plugin's custom portaled panels survive);
    calendar visibility is a session-sticky store (toggle via the More popover);
    normalise the right-split sidebar to ~290px and recreate the leaf to reset
    sticky Svelte panel state; screenshots are Retina (multiply CSS-px rects by
    `devicePixelRatio` 2).

---

## Obsidian styling references

- **Default note width:** the default readable-line-length pane is **760px** with
  **28px top/bottom, 32px left/right** padding → usable content **~696px**. Use
  696 as the budget for "does it fit at default width". (The in-note calendar's
  `DESKTOP_MIN_MONTH_PX = 213` in `src/features/journal-header/visible-month-count.ts`
  was tuned so the picker returns 3 months at this width.)
- **Colour tokens / `ColorRef`:** surface theme tokens first in any colour picker
  (semantic — `--text-normal/-muted/-faint`, `--text-accent`, `--text-error/
  -success/-warning`, `--interactive-accent`, `--background-modifier-*`,
  `--checkbox-border-color`; swatches — `--color-{red,orange,yellow,green,cyan,
  blue,purple,pink}`) and only fall back to a raw hex literal. Sizing tokens:
  `--checkbox-size`, `--list-marker-gap`. Data shape:
  `ColorRef = {kind:'token';var} | {kind:'literal';value}`; render as
  `ref.kind==='token' ? var(${ref.var}) : ref.value` (see
  `src/features/journal-tasks/task-models/task-model.type.ts`).
- **`.mod-settings` paints `<button>` as chunky pill chips.** Inside the settings
  tab or any settings-skinned modal, custom controls that shouldn't look like
  buttons (breadcrumb links, inline triggers, tab strips) need raised specificity
  **and** `!important` on `background`/`border`/`box-shadow`/`padding`/`margin`/
  `height`/`min-height` before layering your own style. For controls that *should*
  look like Obsidian buttons, use `ButtonComponent` (it cooperates with the skin).
- **Settings-dialog skin for a custom `Modal`:** `this.modalEl.addClass(
  'mod-settings', '<wrap>')` + `this.contentEl.addClass('vertical-tab-content',
  '<inner>')` gives the wide settings layout; hide the empty
  `.modal-tab-header` / `.vertical-tab-content-container` it would render. Applied
  in `folder-config-modal.ts`.
- **Reading-view task DOM:** a *loose* task `<li class="task-list-item">` has an
  empty `<span class="list-bullet">` as its **first** child, then a `<p>` wrapping
  the `<input class="task-list-item-checkbox">` + (optional `.jf-task-status`) +
  text. To insert an inline marker at the entry start: query the **checkbox first**
  (descendant query — it is *not* a direct `<li>` child), step past a following
  `.jf-task-status`, insert after that; fall back to after `.list-bullet`, else
  prepend to the content host (`<p>` for loose items, the `<li>` for tight). A
  marker placed as an `<li>` child *before* the `<p>` lands on its own line. See
  `process-signifiers.ts` `placeMarker`.
- **Indentation guides force `li { position: relative }`.** With
  `show-indentation-guide` on, Obsidian makes every list `<li>` a positioning
  context, so an absolutely-positioned descendant anchors to its nearest `<li>`,
  not to `.markdown-preview-sizer`. That's why a single far-left margin column
  can't be robustly anchored in reading view (it'd need per-line measurement) and
  the robust reading-view gutter is *per-entry*. Editing view has no `<li>` (lines
  are full-width `.cm-line` divs) so the same technique yields a single column —
  the two views legitimately differ.

---

## Release flow

Release notes come from `CHANGELOG.md`; the workflow
(`.github/workflows/release.yml`) extracts the section between `## [<tag>]` and
the next `## [` via `awk` and passes it to `gh release create --notes-file`.

1. Add a `## [x.y.z]` section to `CHANGELOG.md` (heading format must match
   exactly — the awk extractor depends on it). Commit the feature work first
   (`npm version` refuses a dirty tree).
2. `npm version <patch|minor|major>` — runs `version-bump.mjs` to sync
   `manifest.json` + `versions.json`, then commits (message = the bare version,
   e.g. `2.4.3`) and creates an unprefixed tag (`.npmrc` sets
   `tag-version-prefix=""`).
3. `npm run deploy` to rebuild + push the new build into the demo vault and deploy
   targets, then commit the demo-vault artifact bump (`docs/demo-vault/.../
   manifest.json` + `styles.css`) as a follow-up — message `Bump demo-vault plugin
   to x.y.z` (mirrors the established history; demo `main.js` is git-ignored).
4. `git push origin master` and `git push origin <tag>`. The workflow builds,
   extracts the changelog section, and creates a **draft** GitHub release with
   `main.js` / `manifest.json` / `styles.css` attached.
5. Review and **publish** the draft (`gh release edit <tag> --draft=false`).

If the workflow logs "No CHANGELOG.md section found" and uses a `Release <tag>`
placeholder body, you forgot step 1.

---

## Known traps in the settings tab

### Stale-snapshot `getSettings` closures (fixed in 3.0.1)

`SettingsFormBuilder.render()` takes a one-time snapshot
`const settings = { ...this.getCurrentSettings() }` and passes closures like
`getSettings: () => settings` into section renderers. This is fine for the
*initial render*, but any closure that calls `getSettings()` **after** an
async `saveSettings()` in the same event handler will receive the pre-render
snapshot — which no longer reflects what was just written to disk.

The original bug: the "Add signifier" / "Add category" buttons
1. saved the new item (`saveSettings({ ...snapshot, list: [...list, item] })`), then
2. opened an edit modal whose onSave called `getSettings()` → got the stale snapshot (empty list), then
3. saved `stale.map(...)` → empty array → erased the item.

**Fix applied:** `renderSignifiersSection` and `renderCategoriesSection` now
receive `getSettings: () => this.getCurrentSettings()` so modal callbacks
always read live persisted state.

**Rule for future sections:** any settings section that follows the pattern
*"save to disk → open a modal → modal save mutates the saved list"* must pass
`() => this.getCurrentSettings()` (not `() => settings`) for its `getSettings`
slot. The three remaining `() => settings` closures (`renderTaskFlowOverview`,
`renderTaskFlowDetail`, `renderFolderTaskFlowSection`) are safe because their
callees never call `getSettings()` after an intervening async save.

---

## Shipped-feature design notes

These features are shipped; the canonical detail lives in `CLAUDE.md` and the
per-feature `docs/*.md`. Recorded here are the *why*s and reverted-approach
history that the code alone doesn't explain.

### Task flows (configurable task statuses)

Model is **named task flows**: `taskFlows: Record<string, TaskFlow>` where
`TaskFlow = { statuses: TaskStatus[]; rendering: 'plugin' | 'theme' }`;
`defaultTaskFlow` + per-folder `task-flow:` front-matter override.
`resolveTaskModel` chains folder → default → Simple built-in. Built-in templates
(`src/data-access/task-templates.ts`) are read-only — applied to *seed* a flow.

- **Rendering is flow-level, one mode per flow** — `TaskFlow.rendering` /
  `TaskModel.rendering`. A v3a attempt at *per-status* rendering was reverted:
  mixing plugin and theme rendering inside one nested list paints unreliably
  (the theme's checkbox styling for surrounding rows competes with the plugin's
  injected shell+icon). One mode per flow keeps the status alphabet visually
  consistent. Read sites branch off `model.rendering`, never a per-status field.
- `migrateTaskSettings` is idempotent on every settings load (handles v0
  `taskModel` string, v1 `taskStatuses`/`taskTemplates`, v2 global
  `taskCheckboxRendering`, v3a per-status rendering → v3 flow-level).
- Settings tab is a 3-level drill-down (overview → flow detail → inline status
  detail) with breadcrumb; position persists on the form builder across
  structural re-renders. See `docs/tasks-design.md` (kept in sync).

### Status picker panel (in-house, replaces the native status Menu)

The status icon's right-click/long-press menu — and a *new* left-click case
where a status is configured as its own `next` (`model.opensPickerOnClick(id)`,
a "pick on click" status) — opens `openStatusPicker` (`status-picker-panel.ts`),
a `<body>`-portaled styled list, **not** Obsidian's native `Menu`. Deliberate
choices the code alone doesn't motivate:

- **One imperative vanilla-TS opener for all four surfaces.** The four checkbox
  surfaces split between Svelte (`TaskItem.svelte` → sidebar + in-note block) and
  plain DOM/CodeMirror (`document-tasks-processor.ts`, `document-task-live-preview.ts`).
  A Svelte panel can't be mounted from the DOM surfaces without ceremony, so the
  picker is a single imperative function (mirrors `document-task-menu.ts`'s role)
  that every surface calls — no duplication, identical look.
- **Each surface passes its own writer via `onSelect`.** Disk surfaces use
  `openStatusPickerForTarget` (→ `setTaskStatus`); live preview passes a closure
  to its editor-write `applyStatus`, because a `vault.process` disk write to the
  *open* note is reverted by the editor re-syncing (the same reason cycling uses
  the Editor API there).
- **Dismiss on `mousedown`, not `click`.** The live-preview picker opens on
  `mousedown`; a `click` outside-listener would be tripped by the very trailing
  click that follows and self-close instantly. Listening for `mousedown`/`contextmenu`
  in capture phase avoids that and still catches presses on a CodeMirror editor
  that stops its own events.
- **Anchor to the *visible* icon, never the `display:none` input.** Under plugin
  rendering the native checkbox is hidden (zeroed rect), so the live-preview path
  anchors to the icon span (`input.nextElementSibling`) and only falls back to the
  input in theme rendering, where the input is what's shown.
- The native `Menu` is kept **only** in the `editor-menu` integration
  (`appendStatusMenuItems`) — extending Obsidian's own editor context menu is the
  one place a native menu is correct.
- **The "Migrate task…" row uses a module-level provider, not prop-threading.**
  The feature registers `setStatusPickerMigrationProvider(target → buildSingleTaskMigration(migrationContext(), target))` once in `load()` (cleared in
  `unload()`). The alternative — passing a `MigrationMenuContext` through TaskList →
  TaskItem Svelte props *and* through both document contexts just to reach this one
  panel — was rejected as far more plumbing for a process-wide capability. The
  provider returns `null` (row hidden) for done tasks / non-journal notes / flows
  without a migrated status, so each surface can pass the target unconditionally.
  Surfaces supply the task's current `rawText` (Svelte: `task.rawText`; reading
  view: the absolute line out of `getSectionInfo().text`, which is the whole file;
  live preview: `doc.lineAt(posAtDOM(input)).text`) — migration's own line-match
  guard re-checks on write, so a later edit can't corrupt the copy.

### Signifier placement & the measured gutter

Four placement options (`start` / `end` / `margin` per-row / `margin-column`
single-column; defaults `margin-column` + reserve on). The two margin/gutter
modes are **positioned by JS measurement, never theme-specific CSS constants** —
a fixed CSS offset collides with themes/snippets that restyle bullets/checkboxes/
indentation (broke in AnuPpuccin). The key insight that makes measurement both
robust and cheap: `offset = targetX − hostLeft`, and both are page coords of
elements in the *same* scrolling container, so the offset is **invariant to scroll
and to readable-width re-centering** — recompute only on intrinsic-metric changes
(theme/font/zoom, readable-width toggle, DOM/content change; column mode also on
resize because a theme *could* use width-relative indents). The reserved lane is
**deficit-based** (reserve only how far the leftmost icon would clip past the
nearest overflow-clipping ancestor — 0 when the existing margin already fits), with
WeakMap-cached base padding and live-inline-padding read-back to prevent
oscillation. Implementation and all the recompute triggers are documented in depth
in `CLAUDE.md` (signifiers section), `docs/signifiers.md`, and `gutter-positioner.ts`.

### Master ribbon menu (`JournalRibbonMenuFeature`)

A single plugin "home" ribbon icon (`notebook-text`, label *Journal Folder menu*)
that opens a styled action menu. It **replaced** the two per-sidebar ribbon icons
(`calendar-days` / `list-checks`) — those open actions are now menu items, along
with *Initialise a new journal folder* and a light/dark switch. The feature is a
thin aggregator: constructed **last** in the plugin (after both sidebar features)
and handed callbacks (`folderSidebarFeature.activate()`,
`tasksSidebarFeature.activate()`, `folderSidebarFeature.openInitFolderPicker()`),
so it never reaches across features directly. Those three methods were made
`public` for this; `openInitFolderPicker()` reveals the sidebar then drives the
existing view flow so the new folder auto-selects.

- **Mobile**: Obsidian has **no ribbon strip on mobile**, so a ribbon-only entry
  is desktop-only. The feature also registers an `open-journal-menu` **command**
  (palette + pinnable to the mobile toolbar) — this is the mobile entry point.
  Always add a command for any ribbon-primary affordance.
- **Panel** reuses the sidebar's `.jf-sidebar-menu-*` styling (own
  `RibbonMenuPanel.svelte`, driven imperatively via a `registerApi` callback —
  the feature mounts it into a detached host; it portals to `<body>`). Positioning
  is the shared pure `menu-panel-position.ts` (`computeMenuPanelPosition`, unit
  tested), which `SidebarMenuPanel` was refactored onto too: `placement:'below'`
  for the sidebar menus, `'right'` flyout for the ribbon, and a **centred-sheet
  fallback when there is no anchor** (the command/mobile path). Mobile tap targets
  come for free from the existing `.is-mobile .jf-sidebar-menu-item` rule; the
  centred sheet gets a wider `.is-mobile .jf-ribbon-menu-panel` width.

**Light/dark switch = Obsidian's standard Base color scheme**, not a parallel
theme system. Verified-live internal App API (absent from the public d.ts):
`app.getTheme()` returns the **effective** scheme and *resolves* `'system'` to the
explicit `'obsidian'` (dark) / `'moonstone'` (light); `app.changeTheme(value)`
persists via `setConfig('theme', …)` **and** repaints the body immediately (handles
the CSS transition). Toggle = `changeTheme(getTheme()==='obsidian' ? 'moonstone' :
'obsidian')`. A *Adapt to system* user is flipped to an explicit scheme and left
there (deliberate — we don't try to return to `'system'`). Logic isolated in
`theme-toggle.ts` (unit tested) so the undocumented API has a one-file blast radius.

### Note-based templates (replaces inline template text)

Template content used to live as text in `data.json` (`autoTemplateContent` +
per-tier fields). It now lives in **template notes with standardized filenames**
(`daily-template.md` / `weekly-template.md` / `monthly-template.md` /
`quarterly-template.md` / `yearly-template.md`, plus `default-template.md`
fallback). Design decisions the code alone doesn't motivate:

- **Two locations, both global settings.** `templateFolder` (default
  `Templates/journal-folder` — plugin-namespaced to avoid clashing with a user's
  own `Templates/` or another template plugin) and `templateOverrideFolderName`
  (default `Templates`, resolved *relative to each journal folder*). The
  per-folder override needs **no setting** — it's expressed purely by the files
  present in `<journalFolder>/Templates/`.
- **Filenames are fixed, not user-configurable** (the maintainer's call) — keeps
  detection and the live-preview mapping simple.
- **Template files are copied verbatim, front matter included** (DP1) — unlike the
  old `journal-folder.md`-body source which strips front matter (it shares the file
  with the folder config). The legacy body is **still honoured** as a resolution
  source (DP2 — we don't migrate or mutate config notes), slotting *between* the
  override files and the global files in precedence.
- **Live preview = synthetic current-period note.** A template note isn't a journal
  basename, so the `journal-header` block would no-op. `templateFileTier` classifies
  the file and `buildTemplatePreviewNote` builds a `JournalNote` for *today's* period
  of that tier (duck-typed `TFile`, mirroring the sidebar anchor). So editing
  `monthly-template.md` renders as this month's entry — the "good visual clue" the
  maintainer asked for. Signifiers come free (they apply to all markdown). Nav links
  are best-effort and **inert** for global-folder previews (DP5 — no
  `defaultJournalFolder` fallback). `default-template.md` previews as a daily note.
- **Migration moves *away* from the old model** (DP3) rather than offering a compat
  toggle. `maybeMigrateInlineTemplates` runs once (flag `templatesMigratedToFiles`),
  writes the inline fields into files (never clobbering), and **leaves the old field
  values in `data.json` as a backup** (no longer read). It needs `saveSettings`, so
  the feature is constructed with it in the plugin shell (like the sidebar features).
- Pure logic in `src/data-access/template-folder.ts` + `migrate-inline-templates.ts`
  (both unit-tested); the feature only does the vault IO. Full detail in
  [docs/auto-template.md](auto-template.md).
