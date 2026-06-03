# Task Management — Design (in progress)

Status: **design phase, not implemented**. Captured here so we can keep exploring without losing context.

Branch: `feature/journal-tasks-design`.

## Goal

Surface Markdown tasks (`- [ ] ...` / `- [x] ...`) from journal notes in two places:

1. A panel below the calendar/notes section of the **sidebar**.
2. An in-note **`journal-tasks` code block** (analogous to `journal-header`).

The model is intentionally simplified to **present tasks only** — no past/future buckets, no completion-date stamping.

## Conceptual model

### Reference range

A date range that defines "now" for filtering.

- **Sidebar:** user toggles between `Today` (range = `[today, today]`) and `Dynamic` (range = active journal note's range; non-journal active leaf → falls back to today).
- **In-note block, journal host:** range = host note's range.
- **In-note block, non-journal host:** range = `[today, today]`.

### Scope (which folders to scan)

- **Sidebar, `Dynamic` reference:** active note's folder.
- **Sidebar, `Today` reference:** `tasksSidebarFolders` setting (empty = all known journal folders).
- **In-note block, journal host:** code-block `folders:` if present, else host's folder.
- **In-note block, non-journal host:** code-block `folders:` (required; missing → error via `ErrorMessage.svelte`).

### Note types in scope

- **Sidebar:** all five tiers (gated by `quartersEnabled`). No setting.
- **In-note block:** code-block `units:` key (default = all tiers).

### Inclusion rule

A task is included iff its source note's range **intersects** the reference range.

### Sort

Within the list: ascending by source-note range length (daily → weekly → monthly → quarterly → yearly). Tie-break: `folderPath`, then `sourceLine`.

### Completed filter

A `tasksShowCompleted` boolean. When false, completed (`- [x]`) tasks are hidden and the header surfaces the hidden count.

## Settings

| Field | Type | Layer | UI |
|---|---|---|---|
| `tasksSidebarEnabled` | `boolean` | global-only | Settings tab |
| `tasksSidebarReference` | `'today' \| 'dynamic'` | global-only | Sidebar link toggle |
| `tasksSidebarFolders` | `string[]` | global-only | Sidebar More... → edit scope folders |
| `tasksShowCompleted` | `boolean` | global-only | Sidebar link toggle |
| `tasksMaxItems` | `number` | global-only | Settings tab (default 200) |

Not present: per-folder overrides, `tasksUnitsInScope` (moved to code-block only), past/future toggles, completion-stamping.

## Code-block keys (`journal-tasks`)

```
folders: my-journal, work-journal    # required for non-journal hosts; defaults to host folder otherwise
units: daily, weekly                 # optional; defaults to all tiers
show-completed: true                 # optional; seeds view-local toggle state; defaults to false
max-items: 30                        # optional; defaults to global tasksMaxItems
```

Parser: reuse the existing `key: value` parser from `journal-header`. View-local `showCompleted` state is seeded from the block and **not** written back to the markdown.

## Data model

```ts
interface JournalTask {
  sourceFile: TFile
  sourceLine: number          // 0-based
  rawText: string
  displayText: string
  checked: boolean
  noteUnit: JournalUnit
  noteRangeDays: number
  noteTitleShort: string      // for the chip
  folderPath: string
}
```

## Indexing

Lazy on-demand scan with an in-memory cache keyed by `{path, mtime}`. Invalidation via `vault.on('modify' | 'delete' | 'rename')`. No persistent index. Re-render via the same `bumpVault` pattern the sidebar already uses for the anchor note.

For sidebar `Today` reference: file count is naturally bounded (≤ 5 files per folder per tier).
For `Dynamic` reference on a long-range note (e.g. yearly): bounded by `tasksMaxItems` cap, with a visible "Showing 200 of 247 — increase limit in settings" footer when truncated.

## UI

### Sidebar header

```
TASKS (5 · 3 ✓ hidden)          Today · Show completed · ⋯

☐ Ship v2.2.0 release notes      · daily · 2026-06-03
☐ Review PR #142                 · weekly · W23
☑ Coffee with Sam                · daily · 2026-06-03
```

- `TASKS (n)` when toggle shows completed; `TASKS (visible · k ✓ hidden)` when hiding.
- **Today / Dynamic** and **Show completed / Hide completed** are styled as inline text links (`var(--text-accent)`), implemented as `<span role="button" tabindex="0">` with `onkeydown` Enter/Space handlers and `aria-pressed` reflecting state. Labels describe the *action*, not the current state.
- Both link toggles write back to global settings (`tasksSidebarReference`, `tasksShowCompleted`) via the existing `saveSettings` pipeline.
- **⋯** opens an Obsidian-native `Menu` for the heavier actions: **edit scope folders** (only meaningful when reference is `Today`), **jump to settings**.
- Narrow widths: controls wrap to a second line under the **TASKS** label.

### Row

- Native-looking checkbox (clickable — toggles `[ ]`/`[x]` in source via `vault.process`).
- Task text with internal links live (delegated click handler, same approach as portaled header content).
- Muted chip: `unit · short title` (e.g. `daily · 2026-06-03`, `weekly · W23`). Chip is a link to the source note.
- Completed rows: strikethrough + `--text-muted`.
- Single-line truncate with ellipsis; full text in `title` attribute.

### Truncation footer

```
─────────────────────────
Showing 200 of 247 — increase limit in settings
```

"settings" is a `<span role="button">` that opens the plugin's settings tab. Count reflects post-completion-filter visible items.

### In-note block

Same `TaskList.svelte` component as the sidebar. No portaling needed. View-local `showCompleted` toggle (does not persist). Bad/missing config → `ErrorMessage.svelte`.

## Interactions

- **Click task text** → open source note at line.
- **Click checkbox** → toggle via `vault.process(file, content => …)`. Locate the target line by `(line index, expected prefix match)`. Mismatch → `Notice` and re-scan rather than blind-write.
- **Click unit chip** → open source note.
- **Hover row** → `title` shows full text + source path.

## File layout

```
src/features/journal-tasks/
  journal-tasks-feature.ts
  task-extraction.ts            # pure
  task-sorting.ts               # pure
  task-cache.ts
  task-scope.ts
  reference-range.ts            # pure
  task-toggle.ts                # vault.process flip
  TaskList.svelte
  TaskItem.svelte
  index.ts

src/data-access/journal-task.ts # JournalTask type + extractTasks
```

Sidebar feature gains a panel slot below its existing content; imports `TaskList` and helpers from `journal-tasks`. No reverse dependency.

## Tests (mandatory per project convention)

- `tests/data-access/journal-task.test.ts` — extraction edge cases (indented sublists, nested links, malformed checkboxes).
- `tests/features/journal-tasks/reference-range.test.ts` — all four host-type/reference scenarios.
- `tests/features/journal-tasks/task-scope.test.ts` — folder + unit filter logic, intersection rule.
- `tests/features/journal-tasks/task-sorting.test.ts` — sort order, tie-breaking.
- `tests/features/journal-tasks/task-toggle.test.ts` — indentation preservation, mismatch handling.
- Visibility filter — show/hide completed, hidden-count surfacing, truncation footer trigger.

## Build sequence

1. `JournalTask` type + `extractTasks` + tests.
2. Reference-range resolver + scope resolver + sorting + tests.
3. `task-toggle.ts` + tests.
4. Settings additions + plumbing.
5. Task cache wired to vault events.
6. `TaskList` / `TaskItem` Svelte components + styling.
7. `journal-tasks` code-block processor + feature registration.
8. Sidebar integration: panel, link toggles, More... menu, truncation footer.
9. Docs (`docs/tasks.md` — promote this file), CLAUDE.md update, demo-vault sync, CHANGELOG.

## Decisions made during design

- **Present-only** model (no past/future). Drops completion-date semantics, stamping, and most filter settings.
- **Checkbox toggling from sidebar in scope from v1**, via `vault.process` with line-match guard.
- **Sidebar quick toggles persist to global settings**; the toggles *are* the controls (no duplicate UI in the settings tab).
- **In-note `show-completed` is view-local**, seeded from the block.
- **`tasksUnitsInScope` is code-block-only**, not a setting.
- **`tasksMaxItems` default 200**, with a visible truncation footer.
- **Today / Dynamic** as a direct-flip link, not a menu.
- **Toggle labels describe the action**, not the current state (`Show completed` means "click to show").

## Open / parked

- Sort behaviour for Past/Future buckets — N/A in current scope; revisit only if buckets are reintroduced.
- Compatibility with the Obsidian Tasks plugin's emoji syntax — explicitly out of scope.
- Optimistic UI for checkbox toggle — not needed; vault round-trip is fast.
- Per-folder overrides — explicitly removed; revisit if user demand emerges.
