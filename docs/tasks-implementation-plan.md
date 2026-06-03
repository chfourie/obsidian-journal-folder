# Task Management — Implementation Plan

Companion to [tasks-design.md](tasks-design.md). Executed in one autonomous pass on branch `feature/journal-tasks-design`. No pauses between phases.

## Conventions reminder

- Prettier: single quotes, 2-space indent, no semicolons, trailing commas `es5`, 80-col print width.
- GPL-3.0 license header on every new `.ts` / `.svelte` file (match existing files).
- All date math through `moment` re-exported from `obsidian`.
- Obsidian mock surface lives in `tests/mocks/obsidian.ts` — extend when needed, don't duplicate.
- Tests are mandatory for every functional change. `npm test` must pass before the implementation commit.
- `npm run build` must succeed; afterwards copy `main.js`, `styles.css`, `manifest.json` into `docs/demo-vault/.obsidian/plugins/journal-folder/`.
- Add a `## [Unreleased]` (or next-version) entry to `CHANGELOG.md` summarising the feature.

## Phase 1 — Task model layer (pure, no Obsidian UI)

Files:
- `src/data-access/journal-task.ts` — `JournalTask`, `TaskStatusId` (= `string`).
- `src/features/journal-tasks/task-models/task-model.type.ts` — `TaskModel`, `TaskStatus`.
- `src/features/journal-tasks/task-models/simple-model.ts` — `[ ]` ↔ `[x]`. Lucide icons: `square` / `square-check` (square mode); `circle` / `circle-check` (circle mode).
- `src/features/journal-tasks/task-models/bullet-journal-model.ts` — `[ ] [/] [x] [>] [-]`. Lucide icons (square / circle):
  - open: `square` / `circle`
  - in-progress: `square-dot` / `circle-dot`
  - done: `square-check` / `circle-check`
  - migrated: `square-chevron-right` / `circle-chevron-right`
  - cancelled: `square-x` / `circle-x`
  - cycle: `open → in-progress → done → open`.
  - `isDone`: `done | migrated | cancelled`.
- `src/features/journal-tasks/task-models/resolve-model.ts` — `resolveTaskModel(settings) → TaskModel`.
- `src/features/journal-tasks/task-models/index.ts` — barrel.

`parseLine` regex (model-internal): `/^(\s*[-*+]\s+)\[(.)\]\s?(.*)$/`. Status char looked up in the model's status table; unrecognised → returns null (line is not a known task for this model — leave it alone).

Tests:
- `tests/features/journal-tasks/task-models/simple-model.test.ts`
- `tests/features/journal-tasks/task-models/bullet-journal-model.test.ts`
- `tests/features/journal-tasks/task-models/resolve-model.test.ts`

Cover: parse all status chars; parse rejects non-tasks and unknown chars; serialize round-trips; cycle order; isDone truth table; indentation/bullet variations (`-`, `*`, `+`, leading whitespace).

## Phase 2 — Reference range, scope, sorting (pure)

Files:
- `src/features/journal-tasks/reference-range.ts` — given `{ host: 'sidebar' | 'note', referenceMode: 'today' | 'dynamic', activeNote?: JournalNote }` → `{ start: Moment; end: Moment }`. Sidebar with `dynamic` + non-journal active leaf → `[today, today]`.
- `src/features/journal-tasks/task-scope.ts` — given `{ folders: string[], units: JournalUnit[], referenceRange }` → list of `TFile` candidates whose `JournalNote` range intersects the reference range. Uses `JournalNote.getNotesInPeriod` where possible; for tiers above the reference range size, also include the containing higher-order note.
- `src/features/journal-tasks/task-sorting.ts` — `sortTasks(tasks): JournalTask[]`. Ascending `noteRangeDays`, then `folderPath`, then `sourceLine`.

Tests:
- `tests/features/journal-tasks/reference-range.test.ts` — sidebar/today, sidebar/dynamic-journal, sidebar/dynamic-nonjournal, note/journal, note/non-journal.
- `tests/features/journal-tasks/task-scope.test.ts` — intersection edge cases (boundary days, weekly spanning month, quartersEnabled off, units filter).
- `tests/features/journal-tasks/task-sorting.test.ts` — sort + tie-breakers.

## Phase 3 — Cache + extraction + transition

Files:
- `src/features/journal-tasks/task-cache.ts` — `TaskCache` class. `getTasks(file, model): Promise<JournalTask[]>` uses `vault.cachedRead`; cache key `{path, mtime, modelId}`. `invalidate(path)` on vault `modify` / `delete` / `rename`. Reset cache on model change.
- `src/features/journal-tasks/extract-tasks.ts` — pure helper `extractTasks(content, model, file, journalNote): JournalTask[]`. Walks lines, delegates parsing to `model.parseLine`, fills `noteUnit`/`noteRangeDays`/`noteTitleShort`/`folderPath` from `journalNote`. (`displayText` strips wikilink syntax for display; `rawText` preserves the original.)
- `src/features/journal-tasks/task-transition.ts` — `cycleTaskStatus(app, task, model): Promise<void>` and `setTaskStatus(app, task, status, model): Promise<void>`. Both use `vault.process(file, content => ...)`. Locate target line by index; if the line no longer parses with the same prior status, abort with an Obsidian `Notice` ("Task no longer at expected location — refreshing"). On success, replace the `[?]` token only, preserve everything else byte-for-byte.

Tests:
- `tests/features/journal-tasks/extract-tasks.test.ts` — extraction edge cases (indented sublists, nested links, mixed bullet chars, blank lines).
- `tests/features/journal-tasks/task-cache.test.ts` — hit/miss, mtime change invalidates, model change resets, delete/rename removes entry.
- `tests/features/journal-tasks/task-transition.test.ts` — cycle preserves indentation and trailing text, set-status writes correct char, mismatch path triggers Notice and skips write.

Extend `tests/mocks/obsidian.ts` with whatever `vault.process` / `Notice` stubs are needed.

## Phase 4 — Settings

Files modified:
- `src/data-access/journal-folder-settings.type.ts` — add the seven fields from the design's settings table. JSDoc each with the rationale for global-only.
- `DEFAULT_SETTINGS` — `tasksSidebarEnabled: false`, `tasksSidebarReference: 'dynamic'`, `tasksSidebarFolders: []`, `tasksShowCompleted: true`, `tasksMaxItems: 200`, `taskModel: 'simple'`, `taskCheckboxStyle: 'square'`.
- Global-only allow-list — add all seven fields so the resolver skips them at folder/embedded layers.
- `src/features/journal-folder-settings/journal-folder-settings-tab.ts` (or wherever `renderSettingsForm` lives) — add a **Tasks** section (global-only, no folder mode): toggles for `tasksSidebarEnabled`, dropdowns for `taskModel` (Simple / Bullet Journal) and `taskCheckboxStyle` (Square / Circle), number input for `tasksMaxItems`.

`tasksSidebarReference`, `tasksShowCompleted`, `tasksSidebarFolders` — **no** settings-tab UI (their controls are the sidebar links / More... menu).

## Phase 5 — Svelte components

Files:
- `src/features/journal-tasks/StatusIcon.svelte` — props: `{ status: TaskStatusId, model: TaskModel, checkboxStyle: 'square' | 'circle', onClick, onContextMenu }`. Uses `setIcon` in an `$effect`. Implemented as `<span role="button" tabindex="0">` with keyboard handler.
- `src/features/journal-tasks/TaskItem.svelte` — props: `{ task, model, checkboxStyle, app }`. Renders status icon + display text + chip. Click text/chip → `app.workspace.openLinkText(file.path, '', false)` then scroll to `sourceLine`. Status icon click handlers wire to `task-transition` helpers. Right-click opens an Obsidian `Menu` of `model.statuses`.
- `src/features/journal-tasks/TaskList.svelte` — props: `{ tasks, model, checkboxStyle, app, showCompleted, totalBeforeFilter, totalBeforeCap, maxItems, header: 'sidebar' | 'note', referenceMode?, onToggleReference?, onToggleShowCompleted?, onOpenScopeMenu?, onOpenSettings? }`. Renders header row (`TASKS (...)`, link toggles, ⋯ menu) and the list and the truncation footer.

License headers + Svelte 5 runes (`$props`, `$state`, `$derived`, `$effect`) — match existing components.

No dedicated component tests (Svelte 5 + ItemView mounting is awkward to unit-test); rely on pure-helper coverage and manual demo-vault verification.

## Phase 6 — In-note code block feature

Files:
- `src/features/journal-tasks/journal-tasks-feature.ts` — `JournalTasksFeature extends PluginFeature`. Registers the `journal-tasks` markdown post-processor. On render:
  1. Parse the block body using the same `key: value` parser the journal-header uses (lift it to a shared helper in `data-access/string-utils.ts` if not already shared; otherwise duplicate locally).
  2. Resolve scope (host file: journal → host folder; non-journal → required `folders:` key).
  3. Build reference range.
  4. Load tasks via `TaskCache`, sort, apply view-local `showCompleted`, mount `TaskList` with `header: 'note'`. Bad config → mount `ErrorMessage`.
- `src/plugin/journal-folder-plugin.ts` — `addFeature(new JournalTasksFeature(...))` after `JournalHeaderFeature`.
- `src/features/journal-tasks/index.ts` — barrel.

## Phase 7 — Sidebar integration

Files modified:
- `src/features/journal-folder-sidebar/JournalFolderSidebar.svelte` — when `settings.tasksSidebarEnabled`, render `TaskList` with `header: 'sidebar'` below the existing calendar + notes content (separated by the project's standard horizontal-rule treatment). Wire:
  - `onToggleReference` → `settingsFeature.saveSettings({ tasksSidebarReference: next })`.
  - `onToggleShowCompleted` → `settingsFeature.saveSettings({ tasksShowCompleted: !current })`.
  - `onOpenScopeMenu` → opens a multi-select folder modal seeded with `tasksSidebarFolders`; saves on close. (Reuse `FuzzySuggestModal` pattern if straightforward; otherwise a simple `Modal` with checkbox list. **Simpler path preferred** — one modal, no fancy state.)
  - `onOpenSettings` → `app.setting.open(); app.setting.openTabById(PLUGIN_ID)`.
- `src/features/journal-folder-sidebar/journal-folder-sidebar-view.ts` — extend `SidebarUpdateApi` if needed so the view can push `bumpVault` (already exists) and active-leaf changes (already exists) without re-mount. Sidebar already re-renders on those; the task panel will pick up changes for free via the cache invalidation.

## Phase 8 — Styles

`styles.css`:
- `.journal-folder-tasks-header` row layout (flex, wrap at narrow widths).
- `.journal-folder-tasks-link` — `color: var(--text-accent)`, pointer cursor, hover state; matches the existing **More...** treatment.
- `.journal-folder-tasks-row` — flex row, single-line truncate.
- `.journal-folder-tasks-chip` — `color: var(--text-muted)`, small font-size, anchor styling.
- `.journal-folder-tasks-done` — strikethrough + `color: var(--text-muted)`.
- `.journal-folder-tasks-footer` — muted, top border.
- No bespoke status-icon CSS — let Obsidian theme Lucide icons.

## Phase 9 — Build, sync, document

1. `npm test` — all green.
2. `npm run build` — type check + production build succeed.
3. Copy `main.js`, `styles.css`, `manifest.json` → `docs/demo-vault/.obsidian/plugins/journal-folder/`.
4. Update `CLAUDE.md`:
   - List `JournalTasksFeature` in the feature-set section.
   - Add a `### Tasks` subsection under **UI rendering** with a one-paragraph summary + pointer to `docs/tasks-design.md`.
   - Note the `taskModel` strategy seam for future Tasks-plugin support.
5. Update `CHANGELOG.md` with a new `## [Unreleased]` (or next-version) entry summarising:
   - Sidebar task panel with Today/Dynamic and Show/Hide completed quick toggles.
   - `journal-tasks` code block for in-note task lists.
   - Simple and Bullet Journal task models, square/circle checkbox styling.
6. Stage and commit:
   - All `src/` changes
   - All `tests/` changes
   - `docs/tasks-design.md`, `docs/tasks-implementation-plan.md` (already committed)
   - `docs/demo-vault/.obsidian/plugins/journal-folder/{main.js,styles.css,manifest.json}` per project convention
   - `CLAUDE.md`, `CHANGELOG.md`
   - **Single commit** with message:
     > Add task management feature (sidebar panel + journal-tasks code block)
     >
     > Implements simple and bullet-journal task models behind a TaskModel
     > strategy interface, present-only filtering with Today/Dynamic
     > reference modes, view-local Show/Hide completed quick toggles, and
     > model-aware vault.process status transitions.
     >
     > Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

Do **not** push. Do **not** open a PR. Stop after the commit lands; the user pushes manually.

## Acceptance checklist (run before final commit)

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Demo-vault assets refreshed.
- [ ] Sidebar shows the task panel when `tasksSidebarEnabled` is on, hides it otherwise.
- [ ] Both task models parse, render, cycle, and write correctly.
- [ ] Square / circle styling switches icons cleanly.
- [ ] Truncation footer appears when `tasksMaxItems` is exceeded.
- [ ] Show/Hide completed link writes `tasksShowCompleted` to global settings.
- [ ] Today/Dynamic link writes `tasksSidebarReference` to global settings.
- [ ] In-note `show-completed` is view-local and does not persist.
- [ ] License headers on every new file.
- [ ] CLAUDE.md and CHANGELOG.md updated.
