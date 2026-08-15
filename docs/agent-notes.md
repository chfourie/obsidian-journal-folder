# Agent & contributor working notes

Non-obvious knowledge that isn't derivable from the code. **For AI agents:** this is the
canonical, git-tracked home for what you'd otherwise keep in private session memory. Read it
before non-trivial work, and **append durable learnings here in the same change** — memory
outside the repo isn't shared and can be lost. Keep entries terse; prune what the code now says.

---

## Maintainer conventions

- **Tests ship with functionality.** Non-trivial change → tests in `tests/` in the *same* change.
  Pure refactors may lean on the existing suite; typos/config bumps need nothing. Reuse
  `tests/mocks/obsidian.ts` + `tests/helpers/fixtures.ts`. Run `npm test` before reporting done.
  Live CLI verification **supplements** unit tests, never replaces them — factor pure decision
  logic out (as `task-range-cap.ts`, `reference-range.ts`, `build-task-model.ts` do) so it stays
  testable even when the surface is DOM-bound. Never report work done on a screenshot alone.
- **Prefer robust / theme-stable over pixel-perfect, and surface tradeoffs before implementing.**
  The maintainer dislikes "works on my setup, breaks on yours"; they'll accept a minor cosmetic
  offset to avoid a fragile path. Inherit native/theme behaviour rather than re-measuring or
  hardcoding geometry. Task rows keep native `list-item` flow, never grid/flex; per-flow
  **Theme-checkbox** rendering is the escape hatch for unusual themes.
- **Source mode is a *raw* editing experience.** Every CodeMirror/live-preview extension gates on
  `editorLivePreviewField` and emits **no** decorations in Source mode — no hidden tags, no
  substituted tokens, no added affordances. Track the flag (`lastLivePreview`) and rebuild on a
  Live Preview ⇄ Source toggle like a settings change.
  `isLivePreview(view) = view.state.field(editorLivePreviewField, false) ?? false`.
- **Toggle labels show the *current* state, not the action** (`'today'` → "Today"; completed
  filter → "All tasks" / "Active tasks"), with `aria-pressed` reflecting it. Overrides the older
  "labels describe the action" line in `tasks-design.md`.
- **"Themable" means CSS variables**, not delegating to Obsidian's link-resolution pass. The
  plugin makes the accent-vs-normal call itself. Calendar: link day cells lock to `--text-normal`
  to defeat any theme's `a.internal-link.is-unresolved` recolour (opacity still comes through);
  existing cells and Sundays get `--text-accent`.
- **Don't drive Obsidian + screenshot to iterate on UI layout.** Asked to "match the styling of
  X", read X's source and reuse the same Obsidian-native classes. (The per-folder config modal was
  a one-line `mod-settings` / `vertical-tab-content` fix, visible from the settings-tab source.)
  Reserve screenshots for README updates and genuinely theme-specific rendering.
- **Run `npm run deploy` after every source/style change** — the demo-vault plugin is a built
  copy, not a symlink, and silently lags source. Never copy `data.json`. Skip only for
  docs/test-only edits.

### Lint (`npm run lint` = `eslint-plugin-obsidianmd`)

Same ruleset the community-review scanner runs against a submitted release — run before tagging.
Type-checked against `tsconfig.json` (scoped to `src`; tests excluded).

- **`.svelte` is linted too and is fully type-aware**, via `tsconfig.eslint.json` — extends
  `tsconfig.json` and adds `src/**/*.svelte`, read **only by ESLint** (the build's `tsc` must
  never see `.svelte`). Needs `extraFileExtensions: ['.svelte']`. The svelte block disables core
  `no-undef`/`no-unused-vars` for the `@typescript-eslint` versions (core false-positives on TS
  parameter type annotations and ambient globals) and must re-declare the plugin, which the
  obsidianmd config registers only for `**/*.ts`.
- **`prefer-active-doc` flags bare `document` but NOT bare `window`** — its replacement map has no
  `window` entry, which is how `status-picker-panel.ts` shipped `window.innerWidth`. Using
  `activeWindow` for viewport geometry and `resize` listeners is **review-enforced, not linted** —
  sweep manually when touching positioning. Conversely `prefer-window-timers` *rejects*
  `activeWindow.requestAnimationFrame`, so: rAF/setTimeout on `window`, viewport reads on
  `activeWindow`.
- **`styles.css` carries no `!important`** — every override is won by **specificity** (qualify
  with a shared ancestor + element/class). Competitors are low-specificity `app.css` rules with
  no `!important`; probe live by iterating `document.styleSheets` + `el.matches(sel)` +
  `getPropertyPriority`. Calendar ladder: competitor
  `.markdown-rendered .internal-link.is-unresolved` (0,3,0); cells win at 0,3,1 → exists 0,4,1 →
  sunday 0,5,1 → sunday-current 0,6,1. Accepted caveat: `!important` would beat *any* specificity,
  so a theme with a very specific non-important unresolved-link rule could still win — none of the
  deploy-target themes do.
- **0.4 forbids inline `eslint-disable` of the rules that matter.** `eslint-comments/
  no-restricted-disable` (new in 0.4.0) rejects *any* disable of `obsidianmd/*`,
  `@typescript-eslint/no-deprecated`, `@typescript-eslint/no-explicit-any`, `no-console`,
  `no-eval`, `@microsoft/sdl/no-inner-html`, … — a long-standing, individually justified
  `-- why` disable is now an **error**, not a pass. So the old "prefer an inline disable over
  loosening a rule" advice no longer applies; the escalation order is **fix the code → use the
  rule's own options → per-file allowance with a written reason**, never a blanket off (that
  would hide careless future suppressions, the whole point of the rule).
  - Its options are **gitignore patterns** (matched via the `ignore` package), so a trailing
    `!some/rule` **negation works** and later patterns win. `eslint.config.mjs` re-derives the
    upstream pattern list out of `obsidianmd.configs.recommended` (with a `throw` guard if it
    ever disappears) and re-declares the rule per `files:` with one `!<rule>` appended. Verified
    narrow: a *different* restricted rule disabled in the same file still errors.
  - Current allowances: `obsidianmd/no-tfile-tfolder-cast` in `template-folder.ts` /
    `sidebar-anchor.ts`. (The `@typescript-eslint/no-deprecated` allowance for `.setWarning()`
    died when `minAppVersion` moved to 1.13.0 — every site now calls `.setDestructive()`.)
- **`ui/sentence-case` has real options** — `brands`, `acronyms`, `ignoreWords`, `ignoreRegex`,
  `mode`, `enforceCamelCaseLower` — plus built-in skips (backticked text, `{placeholders}`,
  paths, `Ctrl+S`, version numbers, ALL_CAPS). It lowercases everything after the first word, so
  rewriting a string to dodge it usually fails: `#RRGGBB …` still gets "Expected: `#Rrggbb …`".
  Our three `ignoreRegex` exemptions are the plugin's own name (`Journal Folder` / `Journal
  Tasks`), `Lucide` (the icon library), and a leading hex-colour specimen. Adding `Journal
  Folder` to `brands` instead would have flagged every legitimate lowercase "journal folder" in
  prose. Re-declaring the rule replaces its options wholesale — carry `enforceCamelCaseLower:
  true` over from upstream.
- **`prefer-create-el`'s autofix is right but doesn't typecheck out of the box.** It rewrites
  `activeDocument.createElement('span')` → `activeWindow.createSpan()`, and `obsidian.d.ts`
  (1.13.1) declares `createEl`/`createDiv`/`createSpan`/`createSvg`/`createFragment` as ambient
  globals and on `Node` — but **not on `Window`**. Running `--fix` therefore turns 37 warnings
  into ~320 `no-unsafe-*` errors on an unresolved return type. `src/obsidian-window-dom.d.ts`
  augments `Window` with the same five signatures. Verified live before typing it, not assumed:
  all five exist on `window`, are identical to the globals, and a **popout window's own copies
  create detached nodes owned by that popout's document** — which is precisely why `activeWindow`
  (never bare `window`) is the correct receiver. jsdom has none of them, so `tests/setup-globals.ts`
  polyfills the no-argument forms alongside its `activeDocument`/`activeWindow` shims.
- **Colocated `src/**/*.spec.ts` run under Vitest + jsdom**, where Obsidian's `createEl` /
  `createSpan` prototype extensions don't exist, so `prefer-create-el` is off for spec files
  only. (`tests/` is ignored wholesale; `src/contracts/*/*.spec.ts` is not.)
- One warning targets a **deliberate** choice and stays justified rather than "fixed": the
  declarative `:has` config-note hiding. (The long-standing
  `settings-tab/prefer-setting-definitions` warning is gone — the global tab now implements
  `getSettingDefinitions()`; see the settings-tab architecture note below.)

### Settings tab (declarative, Obsidian 1.13+)

- `minAppVersion` is **1.13.0** — the global tab has **no `display()` fallback**; it renders
  entirely from `getSettingDefinitions()` in `journal-folder-settings-tab.ts`, which is what
  puts every option into Obsidian's settings-search index. `getControlValue` /
  `setControlValue` bridge control keys (= `JournalFolderSettings` field names) to
  `getCurrentSettings` / `saveSettings`. Cross-field side effects live in `setControlValue`
  (folder-name toggle clears the title, reference-style change reseeds both markers,
  heading-level dropdown string↔number coercion); keys whose change alters rendered *content*
  call `update()`, everything else `refreshDomState()` (visible/disabled only).
- Dynamic list sections can't be declared: **task flows** (drill-down flow → status with
  breadcrumbs), **task categories**, and **signifiers** are imperative `SettingPage`
  sub-pages (`TaskFlowsSettingPage`, `SectionSettingPage`), reached via `type: 'page'`
  entries. Each sets `data-jf-settings-page="<id>"` on its container — that's the e2e hook
  (the old `data-jf-settings-tab` / `data-jf-tab-panel` strip is gone everywhere). The page
  factory runs per open, so drill-down state resets when the user navigates away (same
  lifetime the old per-open builder had).
- The **folder modal renders imperatively but mirrors the native look *and flow*** —
  `renderSettingsForm(...)` in `folder-settings-form.ts` builds a root page of `SettingGroup`
  sections (public since 1.11; same `.setting-group` chrome the declarative renderer emits)
  for General/Today/Calendar, plus hand-rolled `.setting-item.mod-navigable` entries (with
  `.setting-item-chevron`) that drill into templates/patterns/tasks sub-pages headed by the
  native `.setting-page-titlebar` back chrome. E2e hooks: `data-jf-folder-page` on the
  container, `data-jf-page-link` / `data-jf-page-back` on the affordances. No custom tab
  strip — its CSS was deleted from `styles.css`. Shared copy and field renderers
  (`PATTERN_TIERS`, placement labels/descs, `attachMomentSetting` / `attachTextSetting`) are
  exported from the tab file so the two surfaces can't drift. Note Obsidian's `createEl`
  `cls` option: pass multiple classes as an **array**, not a space-joined string (the jsdom
  polyfill — and `classList.add` generally — rejects tokens with spaces).
- Declarative control rows carry **no data hooks** — e2e targets them by visible name via the
  `settingExists` / `clickSetting` / `setSettingValue` helpers in `tests/e2e/lib/page.mjs`;
  `openSettings(...pages)` descends `.setting-item.mod-navigable` entries by name. The
  moment-pattern render defs still set `data-jf-setting="<field>"`.
- Verified live (1.13.7): search indexes the tab (`app.setting.searchIndex.tabs` entry with 9
  top-level items; querying "quarterly" surfaces "Enable quarterly notes"), `visible:`
  predicates hide rows via `offsetParent === null` (row stays in the DOM), page entries render
  as `.setting-item.mod-navigable`, and a `change` event on a declarative dropdown persists
  through `setControlValue` to `data.json`.

---

## Vault topology

- **Demo vault** `docs/demo-vault/` — pristine and vanilla: default theme, **zero snippets**. The
  screenshot/repro target. Its `data.json` is gitignored and pre-configured (signifiers
  `important`/`inspiration`/`explore`, `margin-column`). CLI name `demo-vault`.
- **Real deploy targets** (gitignored `deploy-targets.json`): `…/Obsidian/Journal/Journal 2026`
  and `…/Obsidian/Momentum/Momentum 2026` (the latter runs **AnuPpuccin**). Both run ~7 CSS
  snippets (custom-widths, dashboard, rounded-checkboxes, hide-inline-title, …) and the
  **Outliner** plugin, and both have Hot-Reload so `npm run deploy` reloads them.
- **Why it matters:** geometry/absolute-positioning CSS can look perfect in the demo vault and
  break in the real ones, where snippets restyle bullets, checkboxes, indentation, and widths.
  This exact trap had signifier icons overlapping checkboxes in the real vaults only. **Treat the
  demo vault as capable of false positives**; verify layout in a real vault.

---

## Verifying behaviour in real Obsidian

Live-preview / CodeMirror / theme behaviour **cannot** be reproduced in Vitest+jsdom. Drive the
real app via the Obsidian CLI (<https://obsidian.md/help/cli>) instead of asking for `outerHTML`.

Requires Obsidian 1.12.7+, **Settings → General → "Command line interface"** enabled *in that
vault*, and the app running.

**⚠ Two recurring mistakes, both of which fake unrelated failures:**

1. **Run EVERY invocation sandbox-OFF** (`dangerouslyDisableSandbox: true`) — the CLI uses a local
   IPC socket the sandbox blocks. Symptoms that look like app/vault problems but aren't:
   *"unable to find Obsidian…"*, `Command "eval" not found`, intermittent empty replies (in a
   session that mixed sandboxed and unsandboxed calls), and a lying `pgrep` probe. Confirm the
   call ran sandbox-off *before* diagnosing anything else. Applies to every call, not just the first.
2. **Always pass `vault="demo-vault"` explicitly.** A bare `obsidian <cmd>` targets the *focused*
   vault, which is often the repo root opened as a vault named `obsidian-journal-folder` — not the
   demo vault, no signifiers, stale build. Verify with `eval code="app.vault.getName()"` before
   trusting a result. If `eval` reports "not found", you're probably on the wrong vault rather
   than a disabled toggle.
   - **Worse: `vault=<name>` silently falls back to the focused vault when the named vault has no
     open window** — it does *not* error. Verified live: `vault=jf-e2e-vault` executed against the
     focused vault (first the user's real *Journal 2026*, later `demo-vault`) because the e2e
     vault wasn't open. Always confirm `eval code="app.vault.adapter.basePath"` before any
     stateful call. This also means **`npm run test:e2e` from a git worktree is a trap**: the
     runner deploys into the *worktree's* `tests/e2e/jf-e2e-vault` while Obsidian only knows the
     main checkout's registered vault — run e2e from the main checkout.

Registered vaults live in `~/Library/Application Support/obsidian/obsidian.json` (id → path/open).

**Commands:** `eval code=<js>` (runs in-app; `app` in scope, `require('obsidian')` is **not**;
promises awaited; plugin at `app.plugins.plugins['journal-folder']`) · `dev:dom selector=<css>` ·
`dev:screenshot [path=]` · `open file=<name> [newtab]` · `command id=` / `commands` ·
`dev:mobile on|off` · `dev:console` / `dev:errors` · `dev:cdp` · `dev:css` · `outline format=json`.

- **Reload with `plugin:reload id=journal-folder`, never `app:reload`** — the latter reloads the
  whole app, makes `eval` briefly unavailable, churns `.obsidian/workspace.json`, and leaves the
  code-block processor unregistered (header renders as raw `<pre>`). After editing the gitignored
  `data.json`, re-read it with
  `eval code="app.plugins.plugins['journal-folder'].onExternalSettingsChange()"`.
- **`create file=<name>` ignores the name** and writes `Untitled.md`. For a named scratch note,
  write it to disk, wait ~1s for indexing, then `open file=<name>`. Clean up after.
- **Force a leaf into editing view** to inspect CodeMirror DOM (the demo default is reading):
  `await v.setState({...v.getState(), mode:'source'}, {})`, then wait ~500ms.
  Synthetic `el.dispatchEvent(new MouseEvent('mousedown'|'click',{bubbles:true,clientX,clientY}))`
  fires the real CM/Svelte handlers, so behaviour is verifiable end-to-end without a human.
- **A hidden window renders nothing.** Probe `document.hidden` first so occlusion isn't
  misdiagnosed as a rendering bug. A minimized/occluded window can be recovered with
  `window.electronWindow.restore(); …show(); …focus()` (`open -a`, AppleScript, and CDP
  `Page.bringToFront` all failed where this worked). **A locked screen cannot** — start
  `caffeinate -d -i -m` while unlocked before any unattended run.
- **Popout verification is fully scriptable:** `openPopoutLeaf()` → `openFile` →
  `doc = leaf.view.containerEl.ownerDocument` → `doc.defaultView.focus()` (programmatic focus does
  update `activeDocument` — assert it before trusting the run) → dispatch clicks and assert the
  portaled panel's `ownerDocument` is the popout's and its rect fits that window. Detach popout
  leaves afterwards.
- **Clean up after live verification.** App-driven edits leave churn in tracked demo-vault notes
  and `workspace.json`; `git status` and `git checkout --` anything you didn't mean to change.
- Without the CLI: `open -a Obsidian` (sandbox off), `open "obsidian://open?path=<abs>"`. To log
  without a console, `app.vault.adapter.append('.obsidian/<file>.log', …)` — write **under
  `.obsidian/`**, never a vault path (the file watcher reverts open-editor buffers). Never
  `JSON.stringify` a `TFile` (circular).

---

## E2E suite

`tests/e2e/` drives the real plugin through the CLI and asserts on rendered DOM, vault files, and
settings — agent-independent. Run `npm run test:e2e:build`. Docs in `tests/e2e/README.md`;
scenario matrix in `tests/e2e/TEST-PLAN.md`. Selectors are the shipped `data-jf-*` attributes
(settings fields via `data-jf-setting="<key>"`).

- **Isolation = git.** The committed vault `tests/e2e/jf-e2e-vault/` is reverted between tests
  (`git checkout`/`clean`) and the suite's settings re-applied; `resetVault` refuses to run on an
  untracked vault, so fixtures must be committed. Open it manually once to clear the trust prompt.
  `data.json` is force-tracked; `main.js`/`workspace*.json` are gitignored.
- **Traps the harness now handles — keep them in mind when extending:**
  - The CLI binds to the **focused** window and `eval` hangs on a busy one → every call has a
    timeout + refocus-retry.
  - A **leftover modal** sits over the reading view and fails every later render assertion (this
    presented as a mysterious "first N suites fail then recover" cascade). The harness closes
    modals/panels before each test; a spec that opens one should still dismiss it.
  - **Read-after-write races** — assert via `ctx.waitFor(...)`, never an immediate read. Settings
    live in a private field, so read them back from `data.json` via `ctx.readSettings()`.
  - **A non-visible window renders nothing** (see above) — the runner's preflight fails fast on it.
  - **Empty `eval` stdout is a transient, not a result** (the CLI prints `=> <value>` even for
    `undefined`); downstream it surfaces as `Unexpected end of JSON input`. `evalRaw` refocuses and
    retries on empty stdout with escalating backoff `[300,500,800,1200]`ms.
  - **`evalJSON` must resolve before stringify** — `JSON.stringify(promise)` is `"{}"`; the helper
    wraps as `Promise.resolve(x).then(JSON.stringify)`.
- **The settings dialog can open in a POPOUT WINDOW, and then no `document.querySelector` in the
  main window can see it.** Obsidian's global *"Open settings in a separate window"*
  (`vault.getConfig('settingsPopoutWindow')`, gated on `canPopoutWindow`) makes `app.setting.open()`
  spawn a second Electron window and mount `app.setting.containerEl` in **its** document. The
  symptom is maximally misleading: `app.setting.activeTab.containerEl.innerHTML` holds a fully
  rendered tab strip while `{attached:false, inDoc:false, modalsInDom:0}` — the plugin is fine, only
  the *lookup* window is wrong. Plugin `Modal` subclasses (FolderConfigModal, …) never popout, so
  every other modal suite keeps passing. Pinned off two ways: the committed fixture
  `jf-e2e-vault/.obsidian/app.json` (vault config beats the global) **and** a preflight
  `setConfig('settingsPopoutWindow', false)`. Both are needed — `resetVault`'s `git checkout` restores
  app.json between tests and Obsidian re-reads it, so a runtime-only fix is reverted after test one.
- **Fixtures are date-pinned to 2026-06-06, so date-sensitive tests rot by the day.** The fragile
  spot is the sidebar **task panel**: its baseline scope is `anchor: today` + `range: day`, so on
  any other real date a daily-note fixture's tasks fall out of scope and a monthly/yearly note
  takes over. When adding a task-panel test, `applySettings({ tasksSidebarAnchor: 'note' })` (plus
  `ctx.waitFor`) unless you're specifically testing the `today` anchor on the fixture date. The
  other rot-prone shape is any assertion on a control that means "**now**": the calendar's `Current`
  quick-jump goes to the *real* today's month, so assert `ctx.todayDaily()`, never the fixture date.
- **Window size is an input, not an ambient.** Obsidian restores the size a vault was last closed
  at, so a vault last used at 1024x800 silently degrades both harnesses: the in-note calendar
  collapses to fewer months, the sidebar crowds the note, and screenshot rects crop a layout no
  reader will ever see. Both preflights now call `ensureWindowSize()` (`tests/e2e/lib/cli.mjs`),
  which grows the window to `MIN_WINDOW` — **1600x1050**, clamped to the screen and centred,
  overridable via `JF_WINDOW_SIZE=<w>x<h>`. It's a *minimum*: a larger window is left as arranged,
  and fullscreen/maximized are left alone. It warns rather than fails — a cramped run still
  produces valid output. This is the supported way to widen shots; **never `Cmd+=` zoom** (that
  collapses the in-note calendar to one month).
- **Injected `eval` code needs explicit semicolons.** `oneLine` collapses the payload to a single
  line, so the repo's semicolon-free style runs statements together — `Unexpected token 'const'`.
  Same root cause as the existing ban on `//` comments in injected code.

---

## Screenshots

`npm run screenshots` regenerates all 29 README PNGs idempotently — no manual prep. Filter with
`-- header`, list with `-- --list`, reuse the build with `-- --no-deploy`, re-cut crops with
`-- --recrop`. Harness in `scripts/screenshots/` (`run.mjs`, the declarative `scenes.mjs`,
`lib/`), reusing the E2E CLI/DOM plumbing and preflight against `demo-vault`. Run sandbox-off with
the demo vault open and visible. See `scripts/screenshots/README.md`.

- **Always capture from live Obsidian against the demo vault** — a previous Playwright mock
  harness drifted from real Svelte output and was deleted.
- **Never `Cmd+=` zoom** "for readability": it narrows the pane, trips `pickVisibleMonthCount`, and
  collapses the in-note calendar from 3 months to 1. Hide sidebars or widen the window instead.
- **Check the demo vault's `app.json` before capturing.** The harness restores `data.json` but not
  Obsidian's own config, so stray state silently changes geometry — the 3.2.1 shots were taken
  with `readableLineLength: false` left over from a manual session (every pane full-width, 1818px
  instead of 1456px) and had to be retaken. Sanity-check a retake against the previous PNG's
  dimensions (`sips -g pixelWidth -g pixelHeight`).
- **Window size is pinned EXACTLY here, not just floored.** The screenshots preflight and every
  scene call `ensureWindowSize(MIN_WINDOW, { exact: true })`, because the window demonstrably drifts
  mid-run (a hero shot came out 5419px wide instead of 2619px after the window grew to 3000x1750
  partway through) and every crop after the drift silently rescales. E2E keeps minimum semantics;
  screenshots need reproducible dimensions. The drift's cause was never pinned down — `dev:mobile`
  and `dev:screenshot` were both ruled out — so re-pinning per scene is the guard.
- **Scenes rot silently against the demo vault.** `Personal/2026-06-04` was deleted in f74a11f
  ("rebuild demo vault…") but three scenes still opened it, and the auto-template feature helpfully
  seeded an empty stub — so `migrate-tasks-from-note` reported "No active tasks" and the scene
  failed on a *rect*, pointing nowhere near the real cause. Likewise `task-category-edit` looked for
  a category named `Local` that the baseline no longer defines. Prefer structural targets ("the
  first row with an Edit control") over names, and when a rect expression fails on
  `null`/`undefined`, check the scene's fixtures still exist before suspecting the plugin.
- **`deleteTempFiles` must never recursively delete a scratch path's top segment.** It used to
  `rmSync(topmostSegment, {recursive:true})`, and since `TEMPLATE_FILES` writes into
  `Templates/journal-folder/` — six COMMITTED template notes — every run deleted tracked vault
  content and left the tree dirty, which then reads as a mysterious release-time clean-tree failure.
  It now restores git-tracked temp paths (`git checkout --`), deletes only untracked ones, and
  prunes directories with a non-recursive `rmdir` that fails harmlessly when real notes remain.
- **Each scene is self-setting**: optional `settings` (shallow-merged over the backed-up demo
  `data.json`), `tempFiles`, `mobile: true`, and a `setup(ctx)` driving the UI through `data-jf-*`
  hooks. Light mode is forced and restored; the vault is pristine after a run.
- **Capture is drive-then-crop**: the drive saves a full-window frame + sidecar rect under
  `.captures/` (gitignored), then `sips`-crops. `--recrop` re-cuts with no Obsidian running, so a
  bad crop is fixed instantly and a blank crop is diagnosed by opening the saved frame.
- Gotchas: the active leaf holds **two header copies** (reading view + a hidden live-preview one at
  0,0) — scope interactive queries to `.markdown-reading-view` or you drive the hidden one and its
  popover renders blank at top-left. **rAF-positioned panels** are throttled while Obsidian is
  backgrounded, so a freshly opened one sits at its default position — fire a window `resize` after
  opening (`RibbonMenuPanel` / `TaskScopePanel`; `SidebarMenuPanel` no longer needs it). Native
  Obsidian `Menu`s **can't be captured** (they dismiss on the screenshot focus change; portaled
  custom panels survive). Calendar visibility is a session-sticky store. Normalise the right split
  to ~290px and recreate the leaf to reset sticky Svelte state. Screenshots are Retina — multiply
  CSS-px rects by `devicePixelRatio`.

---

## Obsidian styling traps

- **Default note width:** readable-line-length pane is **760px**, padding 28px top/bottom and 32px
  left/right → **~696px** usable. Use 696 as the "does it fit" budget. (`DESKTOP_MIN_MONTH_PX = 213`
  was tuned so the calendar picker returns 3 months at this width.)
- **Colour tokens / `ColorRef`:** offer theme tokens before a raw hex — semantic
  (`--text-normal/-muted/-faint`, `--text-accent`, `--text-error/-success/-warning`,
  `--interactive-accent`, `--background-modifier-*`, `--checkbox-border-color`) and swatches
  (`--color-{red,orange,yellow,green,cyan,blue,purple,pink}`). Sizing: `--checkbox-size`,
  `--list-marker-gap`. Shape: `ColorRef = {kind:'token';var} | {kind:'literal';value}`.
- **`.mod-settings` paints `<button>` as chunky pill chips.** Inside the settings tab or a
  settings-skinned modal, custom controls that shouldn't look like buttons must reset
  `background`/`border`/`box-shadow`/`padding`/`margin`/`height`/`min-height` first. The competing
  `app.css` rules are 0,0,1 / 0,1,1 with no `!important`, so a two-class selector wins on
  specificity alone. For controls that *should* look native, use `ButtonComponent`.
- **Settings-dialog skin for a custom `Modal`:** `modalEl.addClass('mod-settings', …)` +
  `contentEl.addClass('vertical-tab-content', …)`, then hide the empty `.modal-tab-header` /
  `.vertical-tab-content-container` it renders. Applied in `folder-config-modal.ts`.
- **Reading-view task DOM:** a *loose* `li.task-list-item` has an empty `span.list-bullet` as its
  **first** child, then a `<p>` wrapping the checkbox + optional `.jf-task-status` + text. To
  insert an inline marker: query the **checkbox** (a descendant, *not* a direct `<li>` child), step
  past a following `.jf-task-status`, insert after that; fall back to after `.list-bullet`, else
  prepend to the content host. A marker placed as an `<li>` child *before* the `<p>` lands on its
  own line. See `process-signifiers.ts` `placeMarker`.
- **A collapsible task's fold control overlaps the checkbox column.** A reading-view task with
  sub-items gets a `position: absolute` `.list-collapse-indicator` wide enough to cover the
  checkbox; an icon left at `position: static` paints under it, so clicks fold the sub-list instead
  of cycling status. Give the icon `position: relative` (what Obsidian's own checkbox does) — it
  then owns its clicks while the indicator's exposed left edge stays foldable.
- **`margin` is outside the hit box — grow a hit target with `::after`, not padding.** In live
  preview the native checkbox is `display: none` and clicks route to the icon span; a
  `margin-right` gap fell through to `.cm-line` and CodeMirror placed the caret. A transparent
  absolute `::after` keeps `evt.target` on the icon (so `closest('[data-jf-task-icon]')` resolves)
  without inflating the painted background or touching layout. Scope it to `data-jf-task-icon`.
- **Indentation guides force `li { position: relative }`.** With `show-indentation-guide` on, every
  `<li>` becomes a positioning context, so an absolutely-positioned descendant anchors to its
  nearest `<li>`, not `.markdown-preview-sizer`. That's why the robust reading-view gutter is
  *per-entry*, while editing view (full-width `.cm-line` divs, no `<li>`) yields a single column —
  the two views legitimately differ.
- **The community-review scanner lints `styles.css` too** (beyond `npm run lint`) and
  pattern-matches without context: a bare `column-gap` is misread as CSS multi-column even inside
  `display: grid` (write the `gap: <row> <col>` shorthand); duplicate same-property declarations
  (the `height: 1.5em; height: 1lh` fallback idiom) are flagged (use `@supports` instead); every
  `:has()` is flagged (stamp a modifier class in our own components — the two config-note-hiding
  uses are a deliberate keep, since a declarative body-class rule beats a `MutationObserver`);
  `display: contents` draws a partial-support warning. Its *Vault Enumeration* disclosure (from
  `getMarkdownFiles`) is inherent to config-note discovery and not removable.

---

## Release flow

`npm run release -- <patch|minor|major>` (`scripts/release.mjs`) runs everything in order, halting
on first failure: preconditions (clean tree + `## [<next>]` CHANGELOG section) → lint → test →
build → **E2E** → screenshots → commit generated docs → `npm version` (commit + unprefixed tag) →
deploy → commit the demo-vault bump → confirm → push branch + tag. The tag push triggers
`.github/workflows/release.yml`, which builds and creates a **draft** release — review and publish
it (`gh release edit <tag> --draft=false`). Flags: `--dry-run` (works on a dirty tree, reports
blockers), `--yes`, `--skip-screenshots` (E2E is never skippable).

- **Add the `## [x.y.z]` CHANGELOG section first.** The workflow extracts the text between that
  heading and the next `## [` with `awk` for the release body; the heading format must match
  exactly. A `Release <tag>` placeholder body means you forgot it.
- **Needs a local, running, VISIBLE Obsidian** — E2E (targets `jf-e2e-vault`) and screenshots
  (target `demo-vault`) drive the real app, so this can't run on CI.
- **Wrap the run in `caffeinate -d -i -m` and run sandbox-OFF.** The pipeline drives Obsidian
  untouched for minutes, so the display-sleep timer fires, the window goes `document.hidden`,
  Obsidian stops rendering the reading view, and E2E fails with empty previews (it presented as
  whichever suite happened to be running). Tightening System Settings → Lock Screen does **not**
  help, and MDM may enforce a timeout regardless.
- **Deploy churn before `npm version` is expected and auto-discarded.** The E2E and screenshot
  steps copy `manifest.json`/`styles.css` into their vaults, dirtying tracked files; the script
  `git checkout --`s them (`DEPLOYED_VAULT_ARTIFACTS`) right before `npm version`, then re-deploys
  and commits the demo-vault pair fresh. If the *"Tree dirty after committing docs"* guard still
  fires, a genuine **non-artifact** source file is dirty — investigate rather than clean.
- **Attestations:** `release.yml` runs `actions/attest-build-provenance@v2` over the three assets
  (the scanner reports "Missing GitHub artifact attestations" otherwise). Its explicit
  `permissions:` block (`contents`/`id-token`/`attestations: write`) must be extended if you add
  steps needing other scopes — declaring any `permissions:` drops the default grants.
- **Don't re-introduce a committed test-report gallery.** `docs/test-reports/` regenerated ~74 PNGs
  (~11 MB) per release into git history forever and was removed entirely, along with `--report`
  mode and its modules. Specs keep their `ctx.step` / `ctx.shot` calls as documenting **no-ops**.
  If you ever want one back, host the images off `master` (orphan branch / release assets / LFS).
  (The ~18 MB already in history was left alone — not worth rewriting a published repo's history
  and moving 41 tags.)

---

## Invariants worth preserving

Rules whose *why* the code doesn't explain. Per-feature detail lives in the `docs/*.md` files.

**Settings**

- **Stale-snapshot `getSettings` closures.** `SettingsFormBuilder.render()` snapshots settings
  once and passes `getSettings: () => settings`. Any closure calling it **after** an async
  `saveSettings()` in the same handler gets the pre-save snapshot — which erased a
  just-added signifier/category (save list → open modal → modal saved `stale.map(...)` → empty).
  Any section following *save → open modal → modal mutates the saved list* must pass
  `() => this.getCurrentSettings()`. The remaining `() => settings` closures (task-flow sections)
  are safe only because their callees never re-read after an async save.
- The same rule applies to features: anything holding a settings snapshot across an `await` and
  then **saving** must re-read `this.globalSettings` at save time (the snapshot is fine as *input*).
  `maybeMigrateInlineTemplates` silently overwrote mid-flight settings changes this way.
- **Invalidation is diff-gated** (`data-access/settings-invalidation.ts`, pure + unit-tested).
  Every write — settings tab, folder modal, **and the sidebar's scope controls** — shares one
  `saveSettings → propagate → useSettings` pipeline, so unconditional invalidation meant one
  "show completed" click cleared the task cache and re-rendered every reading view. Each feature
  diffs the incoming snapshot against `this.globalSettings` captured *before* `super.useSettings`.
  - `TASK_PARSE_FIELDS` (→ `TaskCache.clear()`) must include the **title patterns**, `startOfWeek`,
    and `quartersEnabled` — cached tasks bake rendered note titles and tier, which the cache's
    mtime + model-id validation can't see.
  - The reading-view `rerender(true)` sweep lives in the signifiers feature but serves *every*
    reading-view surface. It's gated on an **exclusion** list (`RENDER_INERT_FIELDS`), so a new
    unclassified field fails safe (extra re-render, never a stale view). Add pure-UI fields there;
    render-affecting fields need nothing.
  - **Diff by value, not reference** — load / external sync rebuilds the settings object wholesale,
    so a reference diff would re-invalidate on every `onExternalSettingsChange`.
  - **Probe trap:** `rerender(true)` reuses the per-section container divs and replaces their
    contents, so a `dataset` probe on a section div survives and proves nothing. Probe deep content
    elements (`p` / `li`).
- **Embedded block config is type-coerced at the parse layer** by `coerceEmbeddedSettingValue`
  (`folder-settings-resolver.ts`), keyed on `typeof DEFAULT_SETTINGS[key]`: number → `Number`, with
  blank/NaN **skipping the entry** (`Number('')` is 0 — a blank must not become zero); boolean →
  the front-matter convention (only the literal `"false"` is falsy). New numeric/boolean fields get
  this free — don't re-add use-site string comparisons. YAML front matter already delivers typed
  primitives and is untouched.

**Journal notes & the sidebar**

- **The `JournalNote` sibling snapshot is lazy and factory-scoped.** It's cached per parent folder
  *inside one `journalNoteFactoryWithSettings` closure* (shared with notes derived via
  `createNote`/`createNoteOfSameTimeUnit`). Building a fresh factory per file forfeits the cache and
  restores an O(n²) walk (~3.3M string ops on a 5-year daily folder) — build once, then loop.
  `startOfInterval(today, pattern)` is likewise memoised per strategy, keyed on today's value so a
  walk straddling midnight stays correct. The snapshot is computed on the first existence check
  then **frozen**, so walks that never check existence (task candidates, migration pickers) never
  read `folder.children` — and consumers needing freshness after a vault mutation must rebuild the
  note (the sidebar's `bumpVault` tick does).
- **Sidebar vault listeners are scope-filtered *then* 200ms trailing-debounced.** Predicates live in
  `journal-tasks/task-event-scope.ts` (`taskEventAffectsScope` mirrors `resolveTaskFolders`' rules;
  `journal-folder.md` events are **always** relevant because they change folder topology;
  `activeLeafAffectsTaskScope` is true only for a `note` anchor / `note` folder mode) and
  `journal-folder-sidebar/sidebar-vault-events.ts` (`classifyVaultMutation` → known-folder rescan /
  anchor bump / task refresh, accumulated into one debounced flush). Renames must check **both**
  paths. A folder `create` is inert (contents arrive as separate events); folder `delete`/`rename`
  force a conservative full refresh. `resolveTaskFolders.allFolders` is a **thunk** so the
  full-vault walk only runs when that branch is taken. Verified live: editing a non-journal note
  now costs zero `getMarkdownFiles` walks (was one full task pipeline per autosave).
- **Don't import the `journal-tasks` feature *index* from plain-TS modules that unit tests load** —
  it re-exports Svelte components and Vitest's transform chokes when the import arrives via a
  `.ts`-only test. Import the concrete module. (Views are fine; they aren't unit-loaded.)

**Tasks**

- **Fence-awareness is shared, not re-implemented.** Both `extractTasks` and
  `findDocumentTaskLines` must apply the identical rule via `fence-tracker.ts` — the renderer emits
  no item for fenced lines, so a parser that counts a fenced `- [ ] …` desyncs the positional zip
  for every later task, and a status click could rewrite a line *inside* the code block. Deliberate
  choices: openers at any indent (over-suppressing inside an indented code block is the safer
  failure), tilde + backtick, CommonMark closer rules, unclosed fence runs to EOF, blockquotes out
  of scope. `findDocumentTaskLines` tracks fence state from line 0, not `lineStart`, so both agree
  on absolute lines.
- **`buildTaskModel` is memoised on the statuses array's *identity*** (`WeakMap`). Sound only
  because the flow editor always builds **new** arrays (`[...statuses, x]`, `cloneTemplate`,
  filtered copies) and never mutates in place — a future editor that `push`es into an existing
  flow's `statuses` would serve a stale model until the next save. Relatedly, `FALLBACK_FLOW` is
  cloned **once at module scope**: a per-call clone would defeat the memo, while handing out the
  shared `BUILTIN_TEMPLATES` array risks mutation poisoning a read-only template.
- **`TaskFlow.migratedStatus` is three-state** — a status id, `MIGRATED_STATUS_CLEARED` (`''`, the
  user's deliberate "(None)", which settings-load auto-wire must not re-populate), and `undefined`
  (never set; auto-wire may fill it). `TaskStatusId` is a plain string, so only the sentinel
  constant expresses the distinction — use it, not a bare `''`.
- **`capVisibleTasks` (`task-snapshot.ts`) solely owns filter-then-cap ordering**, so the cap trims
  only *visible* tasks and `hiddenCompletedCount` covers everything in scope. All three list
  surfaces consume it; filtering completed post-cap in the Svelte components (the old shape) let
  hidden tasks eat cap slots. The header counts the **pre-cap** visible population
  (`taskListHeaderLabel`) so it can't contradict the "Showing X of N" footer.
- **`migrateTasks` refuses a destination that is also a source.** The pickers already exclude it,
  but the exported writer must not trust its callers — without the guard it stamps the origin and
  appends an active duplicate into the same note.
- **Rendering is flow-level, one mode per flow.** Per-status rendering was tried and reverted:
  mixing plugin and theme rendering in one nested list paints unreliably (the theme's checkbox
  styling for surrounding rows competes with the injected shell+icon). Read sites branch on
  `model.rendering`, never a per-status field. `migrateTaskSettings` is idempotent on every load and
  handles v0→v3.
- **The status picker is one imperative vanilla-TS opener for all four surfaces**
  (`status-picker-panel.ts`) — two are Svelte, two are plain DOM/CodeMirror, and a Svelte panel
  can't be mounted from the DOM ones without ceremony. Each surface passes **its own writer** via
  `onSelect`: disk everywhere except live preview, where a `vault.process` write to the *open* note
  is reverted by the editor re-syncing. It dismisses on **`mousedown`, not `click`** (it opens on
  mousedown; a click listener would be tripped by the very trailing click that follows), in capture
  phase so a CodeMirror editor can't swallow it. It anchors to the **visible icon**, never the
  `display:none` input (zeroed rect), falling back to the input only under theme rendering. The
  native `Menu` survives **only** in the `editor-menu` integration, where extending Obsidian's own
  context menu is correct. The "Migrate task…" row comes from a module-level provider registered
  once in `load()` — threading a context through two Svelte prop chains and both document surfaces
  for one process-wide capability was rejected; it returns `null` (row hidden) for done tasks,
  non-journal notes, and flows with no migrated status.
- **Live-preview `selectionSet` rebuilds are gated per extension** — signifiers only when
  tag-hiding is on; migration references only when the last build **found marker spans in the
  viewport**, and that flag must be recorded *before* the reveal-on-selection filter (a revealed
  span emits no decoration but still needs re-hiding on the next cursor move). Apply the same gate
  to any new decoration extension: a bare cursor move must cost nothing in a decoration-free
  document. `findDocumentTaskLines` takes **pre-split lines** (post-processors run per block and
  `getSectionInfo().text` is the whole file), and the live-preview scan resolves the model once per
  pass, not per checkbox. Cold-cache reads go through `mapWithConcurrency`
  (order-preserving pool of 16 — not chunked batches, so no straggler stalls a boundary).

**Signifiers & the measured gutter**

- **Both axes are positioned by JS measurement, never theme-specific CSS constants** — a fixed
  offset collides with themes/snippets that restyle bullets, checkboxes, and indentation (it broke
  under AnuPpuccin). The insight that makes measurement cheap: `offset = targetX − hostLeft`, both
  page coords in the same scrolling container, so the offset is **invariant to scroll and to
  readable-width re-centering** — recompute only on intrinsic-metric changes. The reserved lane is
  **deficit-based** (reserve only how far the leftmost icon would clip past the nearest
  overflow-clipping ancestor; 0 when the existing margin fits), with WeakMap-cached base padding
  and live inline-padding read-back to prevent oscillation.
- **Vertical must be measured too — `top:0` was the last fixed-CSS assumption and broke.** It
  resolves to the host's **padding-box** top, and core Obsidian gives editor heading lines
  `padding-top: var(--p-spacing)` (~16px, in `app.css`, so theme-independent), floating the icon
  ~16px above the heading. Both positioners now read `getComputedStyle(host).paddingTop` and write
  it as inline `top` (`0` for unpadded blocks → byte-identical to the old behaviour).
- **Per-row (`margin`) live preview anchors on the rendered `.cm-formatting-list` bullet, not
  `coordsAtPos`** — the marker-character coordinate lands ~one indent step right of the visible
  bullet (12px plain, wider under **Outliner**). Non-list lines fall back to the content coordinate.
  Column mode is untouched (it takes a min over `coordsAtPos(line.from)`, so the consistent skew
  cancels). Outliner is in the real vaults but **not** the demo — verify per-entry placement there.

**UI plumbing**

- **Portaled-panel first-open positioning: prefer a `$effect` over a post-open rAF.** An rAF
  scheduled from the open handler runs before `bind:this` populates the element, so the width falls
  back to an estimate (one-frame mis-position), and rAF is throttled while Obsidian is backgrounded.
  An `$effect` gated on `open && el` runs exactly when the portaled node is measurable. Keep
  `matchTriggerWidth` **only** in the reactive style string — an imperative `style.minWidth` write
  is wiped by the next reactive write — and floor the positioning width at the trigger width, since
  `offsetWidth` may be read before the min-width applies. `RibbonMenuPanel`/`TaskScopePanel` still
  use rAF (no `matchTriggerWidth`, so no visible symptom); port them if they misbehave.
- **Always register a command for any ribbon-primary affordance.** Obsidian has **no ribbon strip
  on mobile**, so a ribbon-only entry is desktop-only; the command is the mobile entry point
  (palette + pinnable to the toolbar). Applies to the ribbon menu (`open-journal-menu`) and Today
  (`open-today`).
- **Light/dark uses Obsidian's own Base color scheme**, via an internal API absent from the public
  d.ts (verified live): `app.getTheme()` returns the **effective** scheme, resolving `'system'` to
  `'obsidian'` (dark) / `'moonstone'` (light); `app.changeTheme(v)` persists *and* repaints
  immediately. A *Adapt to system* user is flipped to an explicit scheme and left there
  (deliberate). Isolated in `theme-toggle.ts` so the undocumented API has a one-file blast radius.
- **`start-new-line-below` dispatches a real `Enter` keydown into `editor.cm.contentDOM`**
  (`startNewLineBelow` in `start-new-line.ts`, after moving the caret to end-of-line; plain-newline
  fallback when `editor.cm` is unreachable) rather than reimplementing Obsidian's list/checkbox/
  blockquote continuation rules (inherit-native-behaviour). **Verification trap:**
  CodeMirror's contentDOM keymap honours an untrusted synthetic keydown, so that inner mechanism
  *is* testable — but Obsidian's **global** keymap ignores untrusted events, so a synthetic
  `Mod+Enter` proves nothing about the binding. The faithful proxy is invoking the registered
  command's `editorCallback(editor, view)` directly — exactly what Obsidian's keymap calls.
  (`executeCommandById` returned `true` but no-op'd under `eval`; don't trust it here.)
- **Today's folder resolution is the pure `resolveTodayFolders(known, isIncluded)`** — 0 known →
  nothing; **exactly one known folder always opens directly, ignoring opt-in** (a single journal
  needs no picker); several with none opted in → offer all (usable out of the box); several with
  some opted in → only those. Placement defaults to `'menu'` rather than `'ribbon'` deliberately:
  adding a ribbon icon to everyone's strip on upgrade is intrusive (same philosophy as
  `taskInteractionScope` defaulting to `'lists'`).
