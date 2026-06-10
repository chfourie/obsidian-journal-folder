# Code-review remediation plan

**Origin:** Full project code review (correctness + performance), 2026-06-10, performed by
four parallel review agents (performance, core/data-access, tasks feature, UI/Svelte) and
synthesized. This document is self-contained: it carries everything needed to execute the
plan from a clean context. Line numbers are as of 2026-06-10 and may have drifted — always
re-locate by the described code, not the number.

**Review baseline:** the working tree at the time included uncommitted in-flight changes to
the task-flow work (`task-models/build-task-model.ts`, `resolve-model.ts`,
`folder-settings-resolver.ts`, `journal-folder-settings.type.ts`,
`journal-folder-settings-tab.ts` + tests). Those changes were reviewed as-is and found clean.

**Explicitly skipped by maintainer decision:** the `calendarVisible` / `userHasToggled`
module-singleton finding in `src/features/journal-header/calendar-visibility.ts` (first
manual toggle disables per-folder `calendarDefaultVisible` defaults for the session). Do
NOT act on it; the current behaviour stands.

## Ground rules for execution

- Read `CLAUDE.md` and `docs/agent-notes.md` first — all conventions there apply.
- **Every step lands with tests** (project rule: code-only changes are not acceptable).
  Pure helpers → `tests/data-access/` or `tests/features/`; Obsidian mock surface lives in
  `tests/mocks/obsidian.ts`.
- After each step (or coherent group): `npm test`, `npm run lint`, `npm run build`, then
  `npm run deploy` (project rule: always build + deploy artifacts after a code change).
- Prefer robust/theme-stable fixes over cosmetic ones; surface tradeoffs before choosing a
  cosmetic path.
- Steps are ordered by value and so that systemic fixes land before polish. Steps are
  independent unless noted; each can be its own commit.
- When a step teaches something durable, append it to `docs/agent-notes.md` in the same
  change.

---

## Step 1 — Fence-aware task parsing (HIGH, data-corruption risk)

**Finding:** `extractTasks` (`src/features/journal-tasks/extract-tasks.ts`) iterates every
line of a file with zero fenced-code-block awareness. A line like `- [ ] example` inside a
` ``` ` fence is parsed as a real `JournalTask`, surfaces in the sidebar/in-note panels,
and — worst case — cycling its status passes the line-match guard in `task-transition.ts`
and **rewrites a line inside the code block** via `vault.process`. It also desyncs the
positional zip in `src/features/journal-tasks/document-task-line-map.ts`
(`findDocumentTaskLines`): the rendered DOM has no `li.task-list-item` for fence content,
so `taskLines[idx]` / `items[idx]` pairing silently drifts for every task after the fence.

**Fix:** track fence state while iterating, in **both** `extractTasks` and
`findDocumentTaskLines` (consider a tiny shared helper so the two stay in lockstep —
they must agree or the zip drifts again):

```ts
let inFence = false
for (let i = 0; i < lines.length; i++) {
  if (/^\s*(```|~~~)/.test(lines[i])) { inFence = !inFence; continue }
  if (inFence) continue
  // existing parse logic
}
```

Decide and test the edge cases: `~~~` fences, indented fences (up to 3 spaces is still a
fence per CommonMark; 4+ is an indented code block), unclosed fence at EOF (everything
after it is fence content), fence inside a blockquote (out of scope — document the
limitation if skipped).

**Tests:** fenced task-like lines are not extracted; tasks before/after a fence keep
correct `sourceLine`; `findDocumentTaskLines` zip stays aligned across a fence;
unclosed-fence case.

---

## Step 2 — Hoist/lazify the `JournalNote` sibling snapshot (CRITICAL perf)

**Finding:** the `journalNote` factory (`src/data-access/journal-note.ts`, ~line 200)
builds `noteNames = (file.parent?.children || []).map(f => f.name.replace(/\.md$/, ''))`
**per instance**. `findTaskCandidates` (`src/features/journal-tasks/task-scope.ts`, ~line
53) and `listJournalNotesInFolder` (same file, ~line 126) construct a `JournalNote` per
journal file in scope → one task-panel refresh of a 5-year daily folder (~1,825 notes) is
O(n²): ~3.3M string ops + ~1,825 array allocations + ~5,500 moment parses. This runs on
every sidebar refresh and every in-note `journal-tasks` render.

**Fix (either or both):**
- (a) Cache the snapshot per `TFolder` inside `journalNoteFactoryWithSettings`'s closure
  (a factory instance lives for exactly one walk, so a `Map<TFolder, string[]>` is safe).
- (b) Make `noteNames` lazy — compute on first use. The candidate walk only calls
  `getMoment` / `getTimeUnit` / `getTitle` / `link`, never the existence APIs
  (`isExistingNote`, `closestSibling`, and the two call sites near lines 479/495), so
  laziness removes the snapshot from the hot path entirely.
- Bonus: memoise `startOfInterval(today, pattern)` per strategy in the factory — it is
  identical for every file in a walk.

**Coordinate with Step 8** (Set-based `isExistingNote`) — doing both at once in
`journal-note.ts` avoids touching the same plumbing twice. The `noteNames` value is also
threaded through `createNote` (~line 479/495); keep the sharing intact.

**Tests:** behaviour-preserving — existing `journal-note` tests must pass unchanged. Add a
test that the factory reuses one snapshot per folder (e.g. count `parent.children`
accesses via a mock folder whose `children` getter increments a counter).

---

## Step 3 — Debounce + scope-filter the sidebar vault listeners (HIGH perf)

**Finding A:** both sidebar views refresh their task panel on every `vault.modify` and
`active-leaf-change` with no debounce and no scope check:
- `src/features/journal-folder-sidebar/journal-folder-sidebar-view.ts` (~lines 193–210)
- `src/features/journal-tasks-sidebar/journal-tasks-sidebar-view.ts` (~lines 100–129)

Each refresh runs `computeTaskSnapshot`
(`src/features/journal-tasks/task-snapshot.ts`, ~lines 68–144), which calls
`findJournalFolderPaths(app)` — a full `vault.getMarkdownFiles()` walk
(`src/data-access/journal-folder-detection.ts`) — **unconditionally**, even when the
folder mode is `specific`/`note` and the result is unused. Typing in any note (journal or
not) triggers the whole pipeline roughly every autosave; a sync importing 1,000 files
triggers it 1,000+ times.

**Finding B:** the combined sidebar's `onVaultMutation`
(`journal-folder-sidebar-view.ts`, ~lines 183–191, 266–271) runs on every vault
create/delete/rename anywhere: full `getMarkdownFiles()` walk (`refreshKnownFolders`) +
anchor `JournalNote` rebuild via `bumpVault` (pays the Step-2 cost) + 51-cell calendar
rebuild + the full task pipeline.

**The model to copy is already in the codebase:** the in-note `TasksBlockRenderChild`
(`src/features/journal-tasks/journal-tasks-feature.ts`, ~lines 447–463) filters events
with `isInScope` and coalesces re-renders through a single rAF (`scheduleRender`).

**Fix:**
- Trailing debounce (~150–250ms) on both views' refresh paths and on `onVaultMutation`
  (one trailing run per event burst).
- Skip `modify` events whose file's parent folder is not in the resolved folder set
  (mirror `isInScope`). Careful with `all journal folders` mode — there the scope check is
  "parent is any journal folder", cheap via `isJournalFolder`.
- Only `refreshKnownFolders` when the event path's basename is `journal-folder.md` (the
  only file that can change the folder list; remember renames need both old and new path
  checked).
- Only `bumpVault` when the mutated file lives in the currently selected folder.
- In `computeTaskSnapshot`, make `allFolders` lazy
  (`allFolders: () => findJournalFolderPaths(app)`) so the full-vault walk only happens
  when `resolveTaskFolders` actually needs it.

**Tests:** pure parts (scope predicate, the lazy `allFolders` contract in
`computeTaskSnapshot` via a counting stub, debounce helper if extracted) are unit-testable.
The view wiring should be covered as far as the existing view-test patterns allow; verify
the rest live (see Verification, bottom).

---

## Step 4 — Extend ESLint to `.svelte` and fix what it flags (HIGH, systemic)

**Finding:** `eslint.config.mjs` scopes the obsidianmd ruleset to `src/**/*.ts` only.
`.svelte` files escape `prefer-active-doc` and the moment-wrapper conventions. Known
fallout (fix all of these; the new lint should then catch any others):

1. `src/features/journal-header/JournalCalendar.svelte` ~line 20:
   `import { moment } from 'obsidian'` + a `@ts-ignore` at ~line 191 (`moment()` call).
   Replace with `import { moment } from 'src/data-access'` (or relative path), drop the
   `@ts-ignore`.
2. Portaled panels append to bare `document.body` and attach scroll listeners to bare
   `document` — in a popout window the panel lands in the wrong document (invisible /
   mispositioned). Replace with `activeDocument`:
   - `src/features/journal-header/JournalHeader.svelte` ~line 80
   - `src/features/journal-header/JournalCalendar.svelte` ~line 93
   - `src/features/journal-folder-sidebar/SidebarMenuPanel.svelte` ~line 61
   - `src/features/journal-folder-sidebar/SidebarCalendar.svelte` ~line 77
   - `src/features/journal-ribbon-menu/RibbonMenuPanel.svelte` ~line 46
   - `src/features/journal-tasks/TaskScopePanel.svelte` ~lines 115, 182, 184
3. Positioning clamps use bare `window.innerWidth/innerHeight` (wrong viewport in a
   popout) — replace with `activeWindow`:
   - `JournalCalendar.svelte` ~line 121, `SidebarCalendar.svelte` ~line 100,
     `SidebarMenuPanel.svelte` ~line 97, `RibbonMenuPanel.svelte` ~line 73
   - `src/features/journal-tasks/status-picker-panel.ts` ~lines 218, 227, 272–273
     (`window.innerWidth/Height` + `window.addEventListener('resize', …)`) — a `.ts` file;
     check why current lint misses it (possibly rule coverage) and fix regardless.

**Lint config:** add `svelte-eslint-parser` (with `@typescript-eslint/parser` as
`parserOptions.parser`) and a `src/**/*.svelte` block to the flat config. Type-aware rules
may need the svelte files added to a tsconfig the parser can use — if full type-aware
linting on `.svelte` is disproportionate effort, land the non-type-aware rules (including
`prefer-active-doc`) and note the limitation in `docs/agent-notes.md`. Also check
`tests/setup-globals.ts`: it polyfills `activeDocument`/`activeWindow` for jsdom, so unit
tests of these components keep working after the swap.

**Tests:** existing component/unit tests must pass; `npm run lint` must pass over the
newly-covered files. Popout behaviour itself is a live-verification item (Obsidian CLI).

---

## Step 5 — Mid-tier perf fixes (MEDIUM)

Three independent sub-items; one commit each or one combined commit.

**5a. Set-based `isExistingNote`** — `src/data-access/journal-note.ts` ~line 315:
`this.noteNames.some(name => name === this.name)` is a linear scan, called per calendar
cell (~51 cells/sidebar build, up to ~255 for a 5-month in-note calendar via
`src/features/journal-header/journal-calendar-info.ts` cell builders). Build a
`Set<string>` lazily once per root note and share it through `createNote` exactly like
the array is shared now. `closestSibling` (~line 418, a regex reduce) can keep the array.
**Do together with Step 2** — same plumbing.

**5b. Diff-gated settings invalidation** —
`src/features/journal-tasks/journal-tasks-feature.ts` `useSettings` (~lines 301–323) does
`#cache.clear()` + `workspace.updateOptions()` on **every** settings save, and
`src/features/journal-signifiers/journal-signifiers-feature.ts` `useSettings`
(~lines 191–217) calls `previewMode.rerender(true)` on every markdown leaf. The sidebar's
scope controls (anchor/range/folder/show-completed in
`JournalFolderSidebar.svelte` ~lines 402–427) save through the same pipeline, so one click
on "show completed" invalidates the whole task cache and re-renders every open reading
view. Fix: diff the incoming settings against the previous snapshot in each `useSettings`;
only `cache.clear()` when parse-relevant fields changed (task flow/model id, migration
markers, signifiers, categories — the cache's model-id validation already encodes much of
this), only `rerender(true)` when a signifier-relevant field changed, and skip both for
pure UI fields (`tasksSidebar*`, `sidebarMode`, …). Keep the diff helper pure and tested.

**5c. Stale-settings snapshot in template migration** —
`src/features/journal-auto-template/journal-auto-template-feature.ts` ~lines 61–68
(`maybeMigrateInlineTemplates`): `const settings = this.globalSettings` is captured, then
after `await runInlineTemplateMigration(...)` the code saves
`{ ...settings, templatesMigratedToFiles: true }` — any settings change made during the
migration's vault writes is silently overwritten. This is the known stale-snapshot trap
(see `docs/agent-notes.md`; fixed for signifiers/categories in 3.0.1). Fix: re-read
`this.globalSettings` at save time:
`await this.saveSettings({ ...this.globalSettings, templatesMigratedToFiles: true })`.
The pre-await snapshot remains fine as the migration input.

**Tests:** 5b's diff helper gets direct unit tests (which field classes trigger which
invalidation); 5c gets a test where settings mutate between migration start and save and
the mutation survives.

---

## Step 6 — Perf micro-optimizations (LOW/MEDIUM, four small wins)

**6a. Double file split per rendered block** —
`src/features/journal-tasks/document-tasks-processor.ts` ~lines 64–74:
`findDocumentTaskLines(section.text, …)` splits the entire file text, then ~line 74 splits
it again for `docLines`. Post-processors run per block per render → O(blocks × file
length). Split once (`const docLines = section.text.split('\n')`) and pass into
`findDocumentTaskLines` (adjust its signature to accept pre-split lines).
**Sequence after Step 1**, which touches `findDocumentTaskLines`.

**6b. Serial cold-cache reads** —
`src/features/journal-tasks/task-snapshot.ts` ~lines 124–135 and
`src/features/journal-tasks/journal-tasks-feature.ts` ~lines 504–515 `await`
`cache.getTasks(...)` per file in a `for` loop. On a cold cache (plugin load, post-clear)
that's N sequential `cachedRead`s. Use chunked concurrency (`Promise.all` over batches of
~16, or a tiny pool). Preserve result ordering.

**6c. Per-checkbox model rebuild in live preview** —
`src/features/journal-tasks/document-task-live-preview.ts`: `resolveModel()` is called per
`swapInput` per checkbox per MutationObserver-triggered scan (~line 367) and again in
`mutationTargetFor` (~line 233). `resolveTaskModel`/`buildTaskModel`
(`task-models/resolve-model.ts`, `build-task-model.ts`) allocate maps + closures each
call. Hoist one `resolveModel()` per scan pass; optionally memoise `buildTaskModel` on
(flow identity, clickOpensPicker) — settings objects are replaced wholesale on save, so a
last-value or `WeakMap` cache is sound.

**6d. Unconditional decoration rebuild on cursor move** —
`src/features/journal-tasks/migration-reference-live-preview.ts` ~lines 129–135 rebuilds
its decoration set on every `selectionSet`. The signifier extension
(`src/features/journal-signifiers/signifier-live-preview.ts`) gates its `selectionSet`
rebuild — mirror that: skip when the last build found no marker spans and the doc/viewport
didn't change (or only rebuild when the selection crosses a known span).

**Tests:** 6a — `findDocumentTaskLines` behaviour unchanged with the new signature;
6b — order preserved, all files loaded (counting stub); 6c — memoisation returns the same
model instance for the same flow object, a new one after a settings swap; 6d — pure gate
helper if extracted.

---

## Step 7 — API hardening (MEDIUM)

**7a. Embedded block config is type-unsafe** —
`src/data-access/folder-settings-resolver.ts` ~lines 101–117 (`getEmbeddedConfig`):
embedded `key: value` pairs are always strings, assigned into typed
`JournalFolderSettings` under `@ts-ignore`. Numeric fields (e.g. `tasksMaxItems`) become
strings → `tasks.length > '200'`-style comparisons silently misbehave; booleans rely on
use-site `isTruthySetting` coercion. The YAML front-matter path is unaffected (typed
primitives). Fix: per-field coercion at the parse layer driven by `typeof
DEFAULT_SETTINGS[key]` (number → `Number(value)` with NaN→skip, boolean →
`isTruthySetting`, string → as-is), or restrict embedded config to string-typed fields and
document it. Either way remove the `@ts-ignore` in favour of an explicit, commented cast.

**7b. `migrateTasks` same-note guard** —
`src/features/journal-tasks/task-migration.ts` ~line 251: the UI excludes the source note
from target pickers (`excludePath`), but the exported `migrateTasks` has no guard. Called
with `destFile.path === task.sourceFile.path` it would stamp origins then append active
duplicate copies into the same note. Add an early return + `Notice` when any
`task.sourceFile.path === destFile.path`.

**7c. Un-cloned built-in template in the fallback model** —
`src/features/journal-tasks/task-models/resolve-model.ts` ~lines 74–77: the fallback
returns `BUILTIN_TEMPLATES[DEFAULT_TEMPLATE_ID]` by reference (the shared array), unlike
the `cloneTemplate` pattern used elsewhere. Read-only today; clone for consistency.

**7d. `''` sentinel for cleared `migratedStatus`** —
`src/features/journal-folder-settings/task-flow-editor.ts` ~line 249 stores `''` (typed
`TaskStatusId`) to mean "user cleared", distinguishing it from `undefined` ("never set",
which the auto-wire migration in `migrate-task-settings.ts` may populate). The falsy guard
in `buildTaskModel` handles it, and the skip-if-cleared behaviour is the documented
intent. Don't change behaviour — make the sentinel explicit in the type
(`TaskStatusId | '' | undefined` or a named constant) and comment the three-state meaning
at the field declaration in the settings type.

**Tests:** 7a — coercion table per field type incl. NaN/garbage input; 7b — same-note call
aborts with no writes; 7c — fallback flow's statuses are not the shared array instance;
7d — existing migration tests still pass, plus one asserting `''` blocks auto-wire while
`undefined` allows it (likely already covered — verify).

---

## Step 8 — UX polish (LOW)

**8a. Post-cap header count** —
`src/features/journal-tasks/TaskList.svelte` ~line 108: with `showCompleted` off the
header renders `(${tasks.length} · ${hiddenCompletedCount} ✓ hidden)`, but `tasks` is the
**post-cap** (`tasksMaxItems`-sliced) list while the hidden count is pre-cap — when the
cap truncates active tasks the header understates them and contradicts the footer's
"Showing 3 of 10". Fix: thread the pre-cap active count into the header (or derive it from
the same source the footer uses). Decide the exact label semantics, keep it one line.

**8b. `SidebarMenuPanel` duplicated min-width + first-open mis-position** —
`src/features/journal-folder-sidebar/SidebarMenuPanel.svelte` ~lines 83–85 vs ~line 102:
`min-width` is written both imperatively (`panelEl.style.minWidth`) and inside the
reactive `panelStyle` string; on first open `panelEl` is still undefined inside the rAF so
the width falls back to an estimated 220px (one-frame mis-position, corrected on the next
reposition event). Fix: drop the imperative write (the reactive string already carries
it), and trigger one re-measure once `panelEl` binds (an `$effect` watching `panelEl`, or
a second rAF). Per project convention, prefer the robust option over pixel-tuning.

**Tests:** 8a — header label cases (capped/uncapped × showCompleted on/off) as component
or pure-helper tests; 8b — covered by existing component tests where feasible, otherwise
live verification.

---

## Verification (after all steps, and per-step where noted)

1. `npm test`, `npm run lint`, `npm run build` — all green.
2. `npm run deploy`, then live-check via the Obsidian CLI (app running, sandbox-off;
   `obsidian plugin:reload id=journal-folder`, then `dev:dom` / `eval` — see
   `docs/agent-notes.md`):
   - A note with a fenced code block containing `- [ ] fake` → no task in sidebar or
     in-note block; tasks below the fence still clickable and writing to the right lines.
   - Typing in a non-journal note → no sidebar refresh churn (can probe with a counter
     via `eval`, or simply confirm no lag).
   - Popout window (Move tab to new window): journal-header More… popover, date picker,
     sidebar menu panel, task scope panel, status picker all render inside the popout and
     clamp to its viewport.
   - Sidebar scope toggles (show completed etc.) no longer flash/re-render open reading
     views.
3. Update `docs/agent-notes.md` with durable learnings (at minimum: the `.svelte` lint
   coverage, the fence-tracking helper location, the settings-diff invalidation pattern).
4. Delete this plan file once everything has landed, or annotate per-step completion if
   landing incrementally.

## Suggested commit grouping

1. Step 1 (fence parsing) — standalone.
2. Steps 2 + 5a (journal-note snapshot + Set lookup) — same file/plumbing.
3. Step 3 (sidebar listeners + lazy allFolders).
4. Step 4 (lint config + activeDocument/activeWindow/moment sweep).
5. Steps 5b + 5c (settings-diff invalidation + stale-snapshot fix).
6. Step 6 (perf micros; 6a after step 1).
7. Step 7 (API hardening).
8. Step 8 (UX polish).
