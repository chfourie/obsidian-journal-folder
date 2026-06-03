# Task Management — Design

Branch: `feature/journal-tasks-design`.

## Goal

Surface Markdown tasks (`- [ ] ...` / `- [x] ...` / `- [/] ...` / etc.) from journal notes in two places:

1. A panel below the calendar/notes section of the **sidebar**.
2. An in-note **`journal-tasks` code block** (analogous to `journal-header`).

The model is intentionally **present-only** — no past/future buckets, no completion-date stamping. Multiple **task models** are supported via a strategy interface: a *Simple* model (vanilla `[ ]`/`[x]`) ships in v1, and a *Bullet Journal* model (five statuses) ships behind the same interface. A future *Tasks-plugin* model is designed-for but not built.

## Task models

One global setting `taskModel: 'simple' | 'bullet-journal'` selects the active model. No per-folder or per-block override — switching is non-destructive because all models share the same status-character alphabet.

### Status character convention

Plugin standardises on the community-conventional checkbox alphabet (used by Tasks plugin, Minimal/Things themes, and others):

| Char | Meaning |
|---|---|
| `[ ]` | open |
| `[/]` | in progress |
| `[x]` | done |
| `[>]` | migrated (handled as done for filtering) |
| `[-]` | cancelled (handled as done for filtering) |

This keeps notes interoperable with the wider Obsidian ecosystem and forward-compatible with a future Tasks-plugin model.

### `TaskModel` interface

```ts
type TaskStatusId = string   // model-defined; core treats as opaque

interface TaskStatus {
  id: TaskStatusId
  label: string
  iconSquare: string   // Lucide icon name
  iconCircle: string   // Lucide icon name
}

interface TaskModel {
  id: 'simple' | 'bullet-journal' | 'tasks-plugin'
  statuses: TaskStatus[]                                    // display order
  parseLine(line: string): { status: TaskStatusId; text: string } | null
  serializeStatus(status: TaskStatusId): string             // returns e.g. '[ ]', '[x]'
  isDone(status: TaskStatusId): boolean                     // drives Hide-completed filter
  nextStatus(current: TaskStatusId): TaskStatusId           // click-to-cycle
}
```

- **Simple**: statuses = `[open, done]`. Cycle: `open → done → open`.
- **Bullet Journal**: statuses = `[open, in-progress, done, migrated, cancelled]`. Cycle: `open → in-progress → done → open`. Migrated/cancelled are accessible via the row's right-click / long-press status menu. `isDone` returns true for `done`, `migrated`, `cancelled`.

### Tasks-plugin model (future, design-only)

The interface is shaped to accommodate it: `isDone` is a method (Tasks plugin allows user-defined statuses), `TaskStatusId` is opaque string, and parse/serialize live entirely inside the model. Drop-in addition when the time comes.

## Conceptual model (model-agnostic)

### Reference range

- **Sidebar:** user toggles between `Today` (range = `[today, today]`) and `Dynamic` (range = active journal note's range; non-journal active leaf → falls back to today).
- **In-note block, journal host:** range = host note's range.
- **In-note block, non-journal host:** range = `[today, today]`.

### Scope

- **Sidebar, `Dynamic`:** active note's folder.
- **Sidebar, `Today`:** `tasksSidebarFolders` (empty = all known journal folders).
- **In-note block, journal host:** code-block `folders:` if present, else host's folder.
- **In-note block, non-journal host:** code-block `folders:` (required; missing → `ErrorMessage.svelte`).

### Note types in scope

- **Sidebar:** all five tiers (gated by `quartersEnabled`).
- **In-note block:** code-block `units:` (default = all tiers).

### Inclusion rule

A task is included iff its source note's range **intersects** the reference range.

### Sort

Ascending by source-note range length (daily → weekly → monthly → quarterly → yearly). Tie-break: `folderPath`, then `sourceLine`.

### Completed filter

A `tasksShowCompleted` boolean. When false, tasks whose status satisfies `model.isDone(status)` are hidden. Header surfaces the hidden count.

## Settings

| Field | Type | Layer | UI |
|---|---|---|---|
| `tasksSidebarEnabled` | `boolean` | global-only | Settings tab |
| `tasksSidebarReference` | `'today' \| 'dynamic'` | global-only | Sidebar link toggle |
| `tasksSidebarFolders` | `string[]` | global-only | Sidebar More... → edit scope folders |
| `tasksShowCompleted` | `boolean` | global-only | Sidebar link toggle |
| `tasksMaxItems` | `number` | global-only | Settings tab (default 200) |
| `taskModel` | `'simple' \| 'bullet-journal'` | global-only | Settings tab |
| `taskCheckboxStyle` | `'square' \| 'circle'` | global-only | Settings tab |

No per-folder overrides. No `tasksUnitsInScope` setting (code-block only).

## Code-block keys (`journal-tasks`)

```
folders: my-journal, work-journal    # required for non-journal hosts; defaults to host folder otherwise
units: daily, weekly                 # optional; defaults to all tiers
show-completed: true                 # optional; seeds view-local toggle; default false
max-items: 30                        # optional; defaults to global tasksMaxItems
```

Parser reuses the existing `key: value` parser from `journal-header`. View-local `showCompleted` state is seeded from the block and is **not** written back to the markdown.

## Data model

```ts
interface JournalTask {
  sourceFile: TFile
  sourceLine: number          // 0-based
  rawText: string
  displayText: string
  status: TaskStatusId        // opaque to core; model-defined
  noteUnit: JournalUnit
  noteRangeDays: number
  noteTitleShort: string
  folderPath: string
}
```

## Indexing

Lazy on-demand scan with an in-memory cache keyed by `{path, mtime}`. Invalidation via `vault.on('modify' | 'delete' | 'rename')`. No persistent index. Re-render via the same `bumpVault` pattern the sidebar already uses for the anchor note.

For sidebar `Today` reference: file count is naturally bounded (≤ 5 files per folder per tier).
For `Dynamic` reference on a long-range note: bounded by `tasksMaxItems`, with a visible "Showing 200 of 247 — increase limit in settings" footer when truncated.

## UI

### Sidebar header

```
TASKS (5 · 3 ✓ hidden)          Today · Show completed · ⋯

☐ Ship v2.2.0 release notes      · daily · 2026-06-03
◐ Review PR #142                 · weekly · W23
☑ Coffee with Sam                · daily · 2026-06-03
```

- `TASKS (n)` when toggle shows completed; `TASKS (visible · k ✓ hidden)` when hiding.
- **Today / Dynamic** and **Show completed / Hide completed** are inline text links (`var(--text-accent)`), `<span role="button" tabindex="0">` with `onkeydown` Enter/Space handlers and `aria-pressed` reflecting state. Labels describe the *action*.
- Both link toggles write back to global settings (`tasksSidebarReference`, `tasksShowCompleted`) via `saveSettings`.
- **⋯** opens an Obsidian-native `Menu`: **edit scope folders** (only meaningful when reference is `Today`), **jump to settings**.
- Narrow widths: controls wrap to a second line under the **TASKS** label.

### Row

- Leading status affordance: Lucide icon via `setIcon`. Icon name comes from the active model's `statuses[].iconSquare` or `iconCircle` based on `taskCheckboxStyle`.
- **Left click** the status icon → `model.nextStatus(current)`, written via `vault.process`.
- **Right click / long-press** the status icon → Obsidian `Menu` of all statuses for the active model (check mark on current).
- Task text with internal links live (delegated click handler, same approach as portaled header content).
- Muted chip: `unit · short title` (e.g. `daily · 2026-06-03`, `weekly · W23`). Chip is a link to the source note.
- Rows whose status satisfies `model.isDone(status)`: strikethrough + `--text-muted`.
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
- **Click status icon** → cycle to next status via `vault.process(file, content => …)`. Locate target line by `(line index, expected status prefix match)`. Mismatch → `Notice` and re-scan rather than blind-write.
- **Right-click / long-press status icon** → status menu (model-defined).
- **Click unit chip** → open source note.
- **Hover row** → `title` shows full text + source path.

## File layout

```
src/features/journal-tasks/
  journal-tasks-feature.ts
  task-cache.ts
  task-scope.ts
  reference-range.ts            # pure
  task-sorting.ts               # pure
  task-transition.ts            # vault.process status writer (model-aware)
  task-models/
    task-model.type.ts          # TaskModel, TaskStatus, TaskStatusId
    simple-model.ts
    bullet-journal-model.ts
    resolve-model.ts            # settings → active TaskModel
    index.ts
  TaskList.svelte
  TaskItem.svelte
  StatusIcon.svelte             # setIcon wrapper; picks square/circle variant
  index.ts

src/data-access/journal-task.ts # JournalTask type (no parser — model owns it)
```

Sidebar feature gains a panel slot below its existing content; imports `TaskList` and helpers from `journal-tasks`. No reverse dependency.

## Styling

- Circle vs square: body class `journal-folder-task-circles` toggles which Lucide icon variant the row renders. No bespoke CSS for status icons — let Obsidian theme them.
- Completed/done-equivalent rows: strikethrough + `var(--text-muted)`.
- Link toggles: `var(--text-accent)` with hover state; `·` separators in `var(--text-muted)`.

## Tests (mandatory per project convention)

- `tests/features/journal-tasks/task-models/simple-model.test.ts` — parse, serialize, cycle, isDone.
- `tests/features/journal-tasks/task-models/bullet-journal-model.test.ts` — same surface, all five statuses.
- `tests/features/journal-tasks/task-models/resolve-model.test.ts` — settings → active model.
- `tests/features/journal-tasks/reference-range.test.ts` — all four host-type/reference scenarios.
- `tests/features/journal-tasks/task-scope.test.ts` — folder + unit filter, intersection rule.
- `tests/features/journal-tasks/task-sorting.test.ts` — sort order, tie-breaking.
- `tests/features/journal-tasks/task-transition.test.ts` — indentation preservation, mismatch handling, model-agnostic cycle.
- `tests/features/journal-tasks/task-cache.test.ts` — cache hit/miss, mtime invalidation.
- Visibility filter — show/hide completed, hidden-count surfacing, truncation footer trigger.

## Decisions captured

- **Present-only** model (no past/future).
- **Status-character alphabet** is `[ ] [/] [x] [>] [-]` — community standard.
- **Task model is global**, not per-folder or per-block.
- **Status transitions** via left-click cycle + right-click menu, delegated to active `TaskModel`.
- **Migrated / cancelled** treated identically to completed for filtering (`isDone` returns true).
- **Migration is syntactic only** in v1 — plugin doesn't auto-copy tasks to a future note; user marks `[>]` manually.
- **Circle/square checkboxes** controlled via a global setting; uses Lucide icon variants, no bespoke CSS.
- **Checkbox toggling from sidebar is in scope from v1**, via `vault.process` with line-match guard.
- **Sidebar quick toggles persist** to global settings; the toggles *are* the controls (no duplicate UI in the settings tab).
- **In-note `show-completed` is view-local**, seeded from the block.
- **`tasksUnitsInScope` is code-block-only**, not a setting.
- **`tasksMaxItems` default 200**, with a visible truncation footer.
- **Today / Dynamic** as a direct-flip link, not a menu.
- **Toggle labels describe the action**, not the current state.

## Out of scope (v1)

- Per-status filters in the header (only the binary Show/Hide completed link).
- Auto-migration ("migrate to tomorrow's daily").
- Configurable cycle order.
- Compatibility with Tasks-plugin emoji metadata (due dates, priorities, recurrence).
- Per-folder model or filter overrides.
