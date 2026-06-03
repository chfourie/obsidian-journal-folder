# Task Management — Design

Branch: `feature/journal-tasks-design`.

## Goal

Surface Markdown tasks (`- [ ] ...` / `- [x] ...` / `- [/] ...` / etc.) from journal notes in two places:

1. A panel below the calendar/notes section of the **sidebar**.
2. An in-note **`journal-tasks` code block** (analogous to `journal-header`).

The model is intentionally **present-only** — no past/future buckets, no completion-date stamping. The task model is **user-configurable** via named **task flows**: a flow is a `TaskStatus[]` (markdown char, label, `isDone`, per-status `next`, rendering choice, shell + icon + colour) stored under a user-chosen name. Four **built-in templates** (Simple, Kanban, Bullet Journal, GTD) ship as read-only starting points — the user applies one to seed or reset a flow.

## Task model

The active model is **built from `settings.taskFlows[name]`** at runtime via `buildTaskModel(statuses)`. Each folder picks which flow it uses; edits to a flow propagate to every folder pointing at it.

Settings:

| Field | Type | Layer | Purpose |
|---|---|---|---|
| `taskFlows` | `Record<string, TaskStatus[]>` | global | Dictionary of named flows. Built-in templates are not stored here (they live in code). |
| `defaultTaskFlow` | `string` | global | Name of the flow used by folders that haven't set an override; also the fallback when a folder's override names a missing flow. |
| `taskFlow` | `string` | per-folder | Front-matter `task-flow:` override naming the flow this folder uses. Empty = use `defaultTaskFlow`. |

**Resolution chain** (`resolveTaskModel`): folder override `taskFlow` → `defaultTaskFlow` → built-in Simple template as ultimate fallback.

**Migration** (`migrateTaskSettings`, idempotent, runs on every settings load) handles three legacy shapes:
- v0 (`taskModel: 'simple' | 'bullet-journal'`) → promoted to a flow named after the template label
- v1 (`taskStatuses` + `taskTemplates` + `currentTaskTemplate`) → user templates copied into `taskFlows`; the live `taskStatuses` array becomes the default flow
- v2 (global `taskCheckboxRendering`) → stamped onto every status's per-status `rendering` field

**Deletion warning** — `findFoldersUsingTaskFlow(app, name)` scans every `journal-folder.md` for the `task-flow:` key; the delete-flow modal lists affected folders. Folders pointing at a deleted flow automatically fall back to the default via the resolver — no front-matter cleanup needed.

### Status character convention

Built-in templates draw from the community-conventional checkbox alphabet (used by Tasks plugin, Minimal/Things themes, and others) so notes stay interoperable across the Obsidian ecosystem:

| Char | Built-in meaning |
|---|---|
| `[ ]` | open |
| `[/]` | in progress / next action |
| `[x]` | done |
| `[>]` | migrated (handled as done for filtering) |
| `[-]` | cancelled (handled as done for filtering) |
| `[d]` | delegated (Bullet Journal template) |
| `[?]` | waiting (GTD template) |

Users may pick any single character per status when editing the flow. Themes that don't recognise a custom character render it as a plain checkbox — the plugin's own icon rendering remains accurate either way.

### `TaskStatus` and `TaskModel`

```ts
type TaskStatusId = string
type TaskRendering = 'plugin' | 'theme'

interface TaskStatus {
  id: TaskStatusId
  label: string
  char: string                  // on-disk character inside [ ]
  isDone: boolean               // drives Hide-completed filter
  next: TaskStatusId            // per-status forward link for left-click cycle
  rendering: TaskRendering      // per-status: 'plugin' = custom shell/icon; 'theme' = native checkbox
  shell: ShellAppearance        // frame: shape + bg + border + colour (ignored when rendering = 'theme')
  icon: IconSpec                // inner glyph + colour + inset (ignored when rendering = 'theme')
}

interface TaskModel {
  id: string                    // signature over (char, isDone, next) — drives cache invalidation
  statuses: TaskStatus[]
  parseLine(line: string): { status: TaskStatusId; text: string } | null
  serializeStatus(id: TaskStatusId): string
  isDone(id: TaskStatusId): boolean
  nextStatus(current: TaskStatusId): TaskStatusId   // reads per-status `next`; falls back to first status on dangling refs
}
```

`buildTaskModel(statuses)` is the only constructor — it builds a model from a status array. There's no "model singleton" anymore; the same function backs the built-in templates and every named flow.

**Per-status rendering** lets a single flow mix theme-styled and plugin-styled checkboxes. Themes that support `[ ]` `[/]` `[x]` but not `[d]` can leave the supported chars to the theme and let the plugin paint the rest. `StatusIcon.svelte`, the document post-processor, and the live-preview extension all look up `statusEntry.rendering` per row — there's no global rendering setting.

### Built-in templates

Four templates ship in code at `src/data-access/task-templates.ts`:

| Template | Statuses | Notes |
|---|---|---|
| **Simple** | `[ ]` `[x]` | Two-state replacement for the original Simple model. |
| **Kanban** | `[ ]` `[/]` `[x]` | Three-lane linear cycle. |
| **Bullet Journal** | `[ ]` `[/]` `[x]` `[>]` `[-]` `[d]` | Original BuJo plus the user-requested **Delegated** entry. |
| **GTD** | `[ ]` `[/]` `[?]` `[x]` | Inbox → next action → waiting → done. |

Primary left-click cycles stay short (typically open → in-progress → done → open); secondary statuses route back to `open` and are reached via the right-click / long-press status menu.

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
| `taskFlows` | `Record<string, TaskStatus[]>` | global-only | Tasks tab → flow detail (Apply template / Save as / Delete / Add status / drag-reorder / drill into status) |
| `defaultTaskFlow` | `string` | global-only | Tasks tab overview (dropdown next to Add new flow) |
| `taskFlow` | `string` | per-folder | Per-folder modal Tasks tab — single dropdown (`Use default` + every named flow). Front-matter key `task-flow:`. |

`taskFlow` is the only task-related field a folder may override; everything else (`taskFlows`, `defaultTaskFlow`, all sidebar/interaction settings) stays global.

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

- Leading status affordance: rendered by `StatusIcon.svelte` based on the status's `rendering` field — either Obsidian's native `<input type="checkbox" data-task="...">` (theme styling) or a custom shell + Lucide / emoji / image / sanitised SVG glyph.
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
    build-task-model.ts         # buildTaskModel(statuses) — the only constructor
    resolve-model.ts            # settings → buildTaskModel(taskFlows[taskFlow ?? defaultTaskFlow])
    task-line-regex.ts          # shared `- [x] text` matcher
    index.ts                    # barrel; re-exports type + templates from data-access
  TaskList.svelte
  TaskItem.svelte
  StatusIcon.svelte             # per-status: native checkbox (theme) or custom shell (plugin)
  render-status-icon.ts         # DOM-side shell + icon paint for the 'plugin' rendering path
  index.ts

src/features/journal-folder-settings/
  task-flow-editor.ts           # Tasks-tab overview + flow detail (drill-down via breadcrumb)
  status-detail-editor.ts       # inline status editor (Basics / Icon / Background / Border nav)
  color-picker.ts               # three-tab ColorRef picker (Semantic / Palette / Custom)
  icon-pickers.ts               # paginated Lucide + emoji pickers with keyword search
  icon-picker-data.ts           # curated Lucide shortcuts + ~180-entry emoji palette
  reorder-statuses.ts           # pure array reorder used by drag-drop
  migrate-task-settings.ts      # v0/v1/v2 → v3 settings migration (idempotent)

src/data-access/
  journal-task.ts               # JournalTask type
  task-model.type.ts            # TaskStatus, TaskModel, TaskRendering, ShellAppearance,
                                #   IconSpec, IconSource = none | lucide | emoji | image | svg
  task-templates.ts             # BUILTIN_TEMPLATES (read-only), cloneTemplate, DEFAULT_TEMPLATE_ID
  sanitize-svg.ts               # DOMParser + allow-list sanitiser for the `'svg'` IconSource kind
  journal-folder-detection.ts   # …plus findFoldersUsingTaskFlow(app, name) for delete-flow warnings
```

Sidebar feature gains a panel slot below its existing content; imports `TaskList` and helpers from `journal-tasks`. No reverse dependency.

## Styling

- Circle vs square: body class `journal-folder-task-circles` toggles which Lucide icon variant the row renders. No bespoke CSS for status icons — let Obsidian theme them.
- Completed/done-equivalent rows: strikethrough + `var(--text-muted)`.
- Link toggles: `var(--text-accent)` with hover state; `·` separators in `var(--text-muted)`.

## Tests (mandatory per project convention)

- `tests/features/journal-tasks/task-models/build-task-model.test.ts` — `next` cycle, dangling-ref fallback, model-id signature, first-char-wins on duplicates.
- `tests/features/journal-tasks/task-models/built-in-templates.test.ts` — template count, all `next` links resolve, delegated present in BuJo, GTD waiting char, kanban linearity.
- `tests/features/journal-tasks/task-models/simple-model.test.ts` — parse, serialize, cycle, isDone (backwards-compat via `simpleTaskModel` singleton).
- `tests/features/journal-tasks/task-models/bullet-journal-model.test.ts` — same surface, all six statuses including delegated.
- `tests/features/journal-tasks/task-models/resolve-model.test.ts` — folder `taskFlow` override wins; falls back to `defaultTaskFlow`; ultimate Simple-template fallback.
- `tests/features/journal-folder-settings/migrate-task-settings.test.ts` — v0 → v3, v1 → v3 (user templates promoted, live statuses become a flow), v2 → v3 (`taskCheckboxRendering` stamped onto every status), idempotent on v3.
- `tests/features/journal-folder-settings/reorder-statuses.test.ts` — pure array reorder used by drag-drop (forward / backward / no-op / out-of-range / non-mutating).
- `tests/data-access/sanitize-svg.test.ts` — allow-list sanitiser (keeps shapes, strips `<script>` / `onclick` / `javascript:` URLs / unknown attrs).

## Settings tab UI

The plugin settings tab uses a top tab strip (General / New-note template / Note patterns / Tasks / Reset). The **Tasks** tab is a three-level drill-down with a breadcrumb at every level beyond the first:

- **Level 1 — Tasks overview** (no breadcrumb): "General task settings" heading (max items, interaction scope) followed by "Task flows" — default-flow dropdown + Add new flow button, then one Obsidian-style `Setting` row per flow (name + status count, "Default" pill on the default, chevron). Click anywhere on a row to drill into Level 2. State persists across in-page re-renders via `editingFlow` / `editingStatusId` / `activeStatusSection` fields on the form builder.
- **Level 2 — Flow detail** (`Tasks › <flow>`): Apply template / Save as / Delete actions (Delete scans for affected folders and lists them in the confirm modal). Below that, the status list — drag-reorder, Add status, per-row Edit (drills to Level 3) and Remove.
- **Level 3 — Status detail** (`Tasks › <flow> › <status>`): the inline editor (no modal). Sticky preview at top showing the painted icon (or theme native checkbox when `rendering: 'theme'`); left nav with Basics / Icon / Background / Border; right detail panel. Every change auto-persists; the breadcrumb is the way back.

Section gating in the status detail:
- **Basics** always available — label, character, Active toggle, Next status, **Rendering** (`plugin` ↔ `theme`).
- **Icon** disabled when rendering is `theme`. Source kind + payload picker (Lucide grid with search + pagination, emoji grid with search + pagination, image URL, monospaced SVG textarea). Icon colour / inset hide for kinds where they don't apply.
- **Background** + **Border** disabled when shape is `none` or rendering is `theme`.

The per-folder modal uses the same tabbed form via `mode: 'folder'` — folder-only fields (no global-only sections, no Reset). The Tasks tab in folder mode is a single dropdown selecting which flow this folder uses.

The colour picker (`color-picker.ts`) is three tabs:

- **Semantic** — purpose-driven tokens (`--text-normal`, `--text-accent`, `--checkbox-border-color`, …) that follow the active theme.
- **Palette** — fixed accent hues (`--color-red` through `--color-pink`).
- **Custom** — `<input type="color">` for hex plus a free-text input for any CSS colour string.

The active tab is inferred from the current `ColorRef`. A "Clear" affordance emits `undefined` (rendered as transparent / inherit).

SVG icons go through `sanitizeSvg` (data-access) before injection. The sanitiser parses with `DOMParser`, drops every element outside the allow-list (script, foreignObject, iframe, image, …), strips every `on*` attribute, and removes `href` / `xlink:href` values starting with `javascript:`, `data:`, or `vbscript:`.
- `tests/features/journal-tasks/reference-range.test.ts` — all four host-type/reference scenarios.
- `tests/features/journal-tasks/task-scope.test.ts` — folder + unit filter, intersection rule.
- `tests/features/journal-tasks/task-sorting.test.ts` — sort order, tie-breaking.
- `tests/features/journal-tasks/task-transition.test.ts` — indentation preservation, mismatch handling, model-agnostic cycle.
- `tests/features/journal-tasks/task-cache.test.ts` — cache hit/miss, mtime invalidation.
- Visibility filter — show/hide completed, hidden-count surfacing, truncation footer trigger.

## Decisions captured

- **Present-only** model (no past/future).
- **Status-character alphabet** built-ins draw from `[ ] [/] [x] [>] [-] [d] [?]` — community standard. User flows may use any char per status.
- **Built-in templates are read-only**; user-managed entities are named **task flows**. Folders pick which flow they use; edits propagate to every folder pointing at the same flow.
- **Per-status rendering** (`plugin` ↔ `theme`) lets a single flow mix theme-styled and custom-painted checkboxes — useful when a theme supports some chars but not others.
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
