# Advanced configuration

> [!IMPORTANT]
> **This is an advanced topic.** Every setting on this page can be edited from the provided UIs — the global *Settings → Community plugins → Journal Folder* tab for vault-wide defaults, and the sidebar's **More... → Edit folder configuration** modal for per-folder overrides. Reach for the file-level configuration covered here only when you need to script setup across multiple vaults, automate per-folder configuration, store config in source control, or override a single header from inside the note itself.
>
> Hand-editing the underlying data structures is fully supported, but the settings UIs are the recommended path because they validate as you go and keep the per-folder front matter sparse.

## The three resolution layers

Settings are resolved in three layers, **last wins**:

1. **Global** — set in *Settings → Community plugins → Journal Folder*. Persists in `.obsidian/plugins/journal-folder/data.json`.
2. **Folder** — front-matter of a file named `journal-folder.md` in the same folder as the journal note. Subfolders never inherit from a parent folder's `journal-folder.md` — each folder controls its own settings.
3. **Embedded** — body of the current `journal-header` (or `journal-tasks`) code block, parsed line-by-line as `key: value`. Applies only to that one block.

Setting names are case-insensitive and tolerant of separators. All of the following are equivalent:

```
journal-folder-title: Atlas Migration
journal_folder_title: Atlas Migration
JOURNAL_FOLDER_TITLE: Atlas Migration
Journal folder title: Atlas Migration
```

## Layer 1 — global data.json

The plugin persists its global settings under `.obsidian/plugins/journal-folder/data.json`. Field names there are `camelCase` (e.g. `dailyNoteTitlePattern`, `quartersEnabled`, `taskFlows`). The settings UI is the canonical writer — hand-edit only when you're scripting setup or syncing across vaults.

The full default shape lives in `src/data-access/journal-folder-settings.type.ts` under `DEFAULT_SETTINGS`. A representative shape:

```jsonc
{
  "dailyNoteTitlePattern": "dddd, DD MMMM YYYY",
  "dailyNoteShortTitlePattern": "ddd, D MMM",
  "weeklyNoteTitlePattern": "gggg [Week] w",
  "monthlyNoteTitlePattern": "MMMM YYYY",
  "yearlyNoteTitlePattern": "YYYY",

  "quartersEnabled": false,
  "autoTemplateEnabled": false,
  "autoTemplatePerTier": false,

  "startOfWeek": "locale-default",
  "defaultJournalFolder": "",
  "hideJournalFolderNotes": true,
  "sidebarMode": "dynamic",

  "tasksSidebarEnabled": false,
  "tasksSidebarReference": "dynamic",
  "tasksMaxItems": 200,
  "taskFlow": "",
  "defaultTaskFlow": "Default",
  "taskInteractionScope": "lists",
  "taskFlows": {
    "Default": [ /* TaskStatus[] — see Task-flow data shape below */ ]
  }
}
```

### Global-only fields

A handful of fields are intentionally **not** honoured at the folder or embedded layers:

- `startOfWeek` — moment's locale is process-wide; per-folder weekday overrides would desync week numbering across the vault.
- `defaultJournalFolder` — UI preference, not a per-folder concept.
- `hideJournalFolderNotes` — affects every `journal-folder.md` row in the file explorer.
- `sidebarMode` — the sidebar is a singleton view.
- `tasksSidebarEnabled`, `tasksSidebarReference`, `tasksSidebarFolders`, `tasksShowCompleted`, `tasksMaxItems` — sidebar / process-wide task UI.
- `taskFlows`, `defaultTaskFlow` — flow definitions live globally; folders pick which flow they use, not what's in it.
- `taskInteractionScope` — interception runs at process-wide layers (markdown post-processor, editor extension).
- `signifiers`, `signifierPlacement`, `signifierHideTagInReadingView`, `signifierHideTagInLivePreview`, `signifierShowTagsOnActiveLine`, `signifierReserveGutter` — one signifier set per vault; see [Signifiers](signifiers.md).
- `taskCategories`, `taskCategoryShowUnderNote` — category definitions are vault-wide.
- the migration *reference* fields (`taskMigrationAddToReference`, `taskMigrationAddFromReference`, `taskMigrationReferenceStyle`, `taskMigrationToMarker`, `taskMigrationFromMarker`, `taskMigrationReferenceOpacity`). The **exception** is `taskMigrationPlacement` / `taskMigrationHeading`, which *are* folder-honoured — they're a per-note layout concern, not a process-wide preference.

## Layer 2 — per-folder `journal-folder.md`

A file named `journal-folder.md` in any folder turns that folder into a journal folder. Per-folder overrides live in its YAML front matter as **kebab-cased keys**:

```markdown
---
journal-folder-title: Atlas Migration
default-calendar-visible-desktop: true
default-calendar-visible-mobile: false
daily-note-title-pattern: dddd, Do MMMM YYYY
quarters-enabled: true
task-flow: Bullet Journal
---
```

The **body** of `journal-folder.md` (everything below the closing `---`) is the per-folder auto-template content. See [auto-template precedence](auto-template.md#template-precedence).

`task-flow` is the only task-related field that a folder may override — flow contents (`taskFlows`) are still edited globally, and everything else in the *Tasks* section is global-only.

> [!TIP]
> The recommended way to edit per-folder settings is the **sidebar tab → More… → *Edit folder configuration*** action. It opens a form pre-populated with the effective values, validates as you go, and writes a sparse diff to `journal-folder.md` so the folder still inherits future global changes for any field you didn't deliberately diverge on.

> [!CAUTION]
> Anything set at folder level applies to every journal header in that folder, but does *not* affect the actual folder name on disk. `journal-folder-title` is a display label only.

## Layer 3 — embedded `key: value`

Inside the body of any `journal-header` or `journal-tasks` code block, lines of the form `key: value` override the same field for that single block:

````markdown
%% EDITING %%
```journal-header
default-calendar-visible-desktop: true
daily-note-title-pattern: dddd, Do MMMM YYYY
```
````

This is the right layer for one-off experiments, examples in documentation, or notes that need to override the folder default for a single rendering.

## Settings reference

All title patterns use [moment.js format syntax](https://momentjs.com/docs/#/displaying/format/). Front-matter keys shown here are the kebab-cased form used by per-folder and embedded layers; the `camelCase` data.json equivalents are derived by stripping the dashes and uppercasing the next letter.

| Setting | What it does |
| --- | --- |
| `daily-note-title-pattern`           | H1 title pattern for daily notes. Don't include sub-day units (hours, minutes). |
| `daily-note-short-title-pattern`     | Pattern used for chips/links pointing to daily notes. Keep it short — multiple chips render side by side. |
| `daily-note-medium-title-pattern`    | Pattern for daily-note links whose target is in a different year than the source — typically the short pattern plus the year, so the year change is explicit. |
| `weekly-note-title-pattern`          | H1 title pattern for weekly notes. **Use `gg`/`gggg` for the year**, not `YYYY`/`GGGG` — the filename uses ISO week-year and they desync at year boundaries. |
| `weekly-note-short-title-pattern`    | Chip/link pattern for weekly notes. Same `gg`/`gggg` caveat. |
| `weekly-note-medium-title-pattern`   | Cross-year weekly link pattern. Same caveat. |
| `monthly-note-title-pattern`         | H1 title pattern for monthly notes. Don't include sub-month units. |
| `monthly-note-short-title-pattern`   | Chip/link pattern for monthly notes. |
| `monthly-note-medium-title-pattern`  | Cross-year monthly link pattern. |
| `quarterly-note-title-pattern`       | H1 title pattern for quarterly notes (when `quarters-enabled` is on). |
| `quarterly-note-short-title-pattern` | Chip/link pattern for quarterly notes. |
| `quarterly-note-medium-title-pattern`| Cross-year quarterly link pattern. |
| `yearly-note-title-pattern`          | H1 title pattern for yearly notes. Don't include sub-year units. |
| `yearly-note-short-title-pattern`    | Chip/link pattern for yearly notes. |
| `yearly-note-medium-title-pattern`   | Cross-year yearly link pattern (rare; usually identical to short). |
| `journal-folder-title`               | Display title shown above the H1 in the header. Typically set per-folder, not globally. |
| `use-folder-name-as-default-title`   | If true and `journal-folder-title` isn't set, falls back to the folder name. |
| `default-calendar-visible-desktop`   | If true, the calendar picker is open by default on desktop when Obsidian starts. A manual toggle in the current session wins over this. |
| `default-calendar-visible-mobile`    | If true, the calendar picker is open by default on mobile when Obsidian starts. Defaults to false because the multi-month layout isn't useful at phone widths. |
| `quarters-enabled`                   | Enables quarterly notes (`YYYY-Q[1-4]`) as a fifth tier. See [Quarterly notes](quarters.md). |
| `start-of-week`                      | First day of the week used by the calendar grid and `gggg-[W]ww` weekly numbering. *Locale default* leaves moment's locale untouched; picking an explicit weekday (`sunday`–`saturday`) overrides it so week 1 still contains January 1. **Global only.** |
| `auto-template-enabled`              | If true, newly created notes whose basename matches a journal pattern and whose folder contains a `journal-folder.md` are seeded with a template body. See [Auto-fill new journal notes](auto-template.md). |
| `auto-template-per-tier`             | If false (default), every new journal note shares `auto-template-content`. If true, the per-tier fields below are used instead, one per note type. The two modes are mutually exclusive. |
| `auto-template-content`              | Single template body used when `auto-template-per-tier` is **off**. Leave blank for the built-in default. Per-folder overrides go in the body of `journal-folder.md`. |
| `daily-note-auto-template-content`   | Template body used for new daily notes when `auto-template-per-tier` is **on**. |
| `weekly-note-auto-template-content`  | Template body used for new weekly notes when `auto-template-per-tier` is **on**. |
| `monthly-note-auto-template-content` | Template body used for new monthly notes when `auto-template-per-tier` is **on**. |
| `quarterly-note-auto-template-content` | Template body used for new quarterly notes when `auto-template-per-tier` is **on**. |
| `yearly-note-auto-template-content`  | Template body used for new yearly notes when `auto-template-per-tier` is **on**. |
| `default-journal-folder`             | Folder path the sidebar tab opens on by default. **Global only.** |
| `hide-journal-folder-notes`          | If true (the default), every `journal-folder.md` is hidden from Obsidian's built-in file explorer. **Global only.** |
| `sidebar-mode`                       | `'dynamic'` (default) makes the sidebar follow the active note; `'static'` holds whichever folder you picked. **Global only.** |
| `tasks-sidebar-enabled`              | Whether the sidebar tab renders the tasks panel below the calendar. **Global only.** |
| `tasks-sidebar-reference`            | `'today'` or `'dynamic'`. Sidebar's reference range for the task panel. **Global only.** |
| `tasks-sidebar-folders`              | Comma-separated folder paths the sidebar's `Today` mode scans; empty = all known journal folders. **Global only.** |
| `tasks-show-completed`               | If true, completed (`isDone`) statuses appear in task lists. **Global only.** |
| `tasks-max-items`                    | Hard cap on rendered tasks per list (default 200). **Global only.** |
| `task-flow`                          | Per-folder override — name of the flow this folder uses. Empty falls back to `default-task-flow`. Per-folder. |
| `default-task-flow`                  | Name of the flow used by folders without an override. **Global only.** |
| `task-flows`                         | Dictionary of named flows. **Global only.** See *Task-flow data shape* below. |
| `task-interaction-scope`             | `'lists'` (default) — interactions only on the plugin's own task surfaces. `'everywhere'` — intercept every task checkbox in rendered documents. **Global only.** |
| `task-migration-placement`           | Where migrated task copies land in the destination note: `after-last-task` (default), `top`, `end`, or `heading`. Per-folder. See [Migrating tasks](tasks.md#migrating-tasks-between-notes). |
| `task-migration-heading`             | Heading text used when `task-migration-placement` is `heading` (default `Tasks`). Per-folder. |
| `task-migration-add-to-reference`    | Whether the origin task gets a forward reference to the destination (default true). **Global only.** |
| `task-migration-add-from-reference`  | Whether the migrated copy gets a back reference to its origin (default true). **Global only.** |
| `task-migration-reference-style`     | `text` / `emoji` / `lucide` (default) — how reference markers render. **Global only.** |
| `task-migration-to-marker` / `task-migration-from-marker` | The forward / back marker for the active style (Lucide markers are `lucide:<name>` tokens). **Global only.** |
| `task-migration-reference-opacity`   | How faded references render, 0–100 (default 30). **Global only.** |
| `signifier-placement`                | `margin-column` (default, all icons far-left) or `margin` (per-entry). **Global only.** See [Signifiers](signifiers.md). |
| `signifier-hide-tag-in-reading-view` / `signifier-hide-tag-in-live-preview` | Replace the matched tag with just the icon in reading view / live preview (both default true). **Global only.** |
| `signifier-show-tags-on-active-line` | When hiding tags in live preview, reveal *all* of the cursor line's tags (default false reveals only the touched tag). **Global only.** |
| `signifier-reserve-gutter`           | Reserve left-margin space so gutter icons never clip (default true). **Global only.** |
| `signifiers`                         | Array of tag→icon bindings. Managed in the **Signifiers** settings tab, not by hand. **Global only.** |
| `task-categories`                    | Array of tag→category groupings shown atop task lists. Managed in the **Tasks** settings tab. **Global only.** |
| `task-category-show-under-note`      | Whether a categorised task *also* appears in its note group (default false). **Global only.** |

## Task-flow data shape

`task-flows` is a dictionary of named flows. Each flow is an array of `TaskStatus` records:

```ts
type ColorRef =
  | { kind: 'token'; var: string }    // CSS variable, e.g. '--color-green'
  | { kind: 'hex';   value: string }  // '#34c759'
  | { kind: 'css';   value: string }  // any CSS colour string

type IconSource =
  | { kind: 'none' }
  | { kind: 'lucide'; name: string }                    // e.g. 'check', 'arrow-right'
  | { kind: 'emoji';  value: string }                   // '🚀'
  | { kind: 'image';  url: string }                     // 'https://…/icon.png'
  | { kind: 'svg';    value: string }                   // inline SVG (sanitised)

interface ShellAppearance {
  shape: 'none' | 'circle' | 'square' | 'rounded'
  background?: ColorRef | null
  border?: { color: ColorRef; width?: number } | null
}

interface IconSpec {
  source: IconSource
  color?: ColorRef
  inset?: number   // 0..1 — fraction of shell to inset the glyph
}

interface TaskStatus {
  id: string             // stable identifier (e.g. 'open', 'in-progress')
  label: string          // shown in the status menu
  char: string           // on-disk character inside [ ]
  isDone: boolean        // drives Hide-completed filter
  next: string           // id of the next status in the left-click cycle
  rendering: 'plugin' | 'theme'
  shell: ShellAppearance // ignored when rendering = 'theme'
  icon:  IconSpec        // ignored when rendering = 'theme'
}
```

Example flow stored under `taskFlows["Default"]`:

```jsonc
[
  {
    "id": "open",
    "label": "Open",
    "char": " ",
    "isDone": false,
    "next": "done",
    "rendering": "plugin",
    "shell": {
      "shape": "circle",
      "border": { "color": { "kind": "token", "var": "--checkbox-border-color" }, "width": 1 }
    },
    "icon": { "source": { "kind": "none" } }
  },
  {
    "id": "done",
    "label": "Done",
    "char": "x",
    "isDone": true,
    "next": "open",
    "rendering": "plugin",
    "shell": {
      "shape": "circle",
      "background": { "kind": "token", "var": "--color-green" },
      "border": null
    },
    "icon": {
      "source": { "kind": "lucide", "name": "check" },
      "color":  { "kind": "token", "var": "--text-on-accent" },
      "inset":  0.7
    }
  }
]
```

> [!WARNING]
> Editing `task-flows` by hand in `data.json` is supported but lossy on a mistake — a malformed entry can hide statuses or break the cycle. Prefer the settings-tab flow editor for any change beyond renaming a label.

## Code-block keys for `journal-tasks`

The `journal-tasks` block accepts a small set of embedded-layer keys. See [Tasks — In-note `journal-tasks` block](tasks.md#in-note-journal-tasks-block) for the user-facing reference.

```
folders: my-journal, work-journal   # required for non-journal hosts; defaults to host folder otherwise
units: daily, weekly                # restricts which tiers are scanned; defaults to all
show-completed: true                # seeds view-local toggle; default false
max-items: 30                       # defaults to global tasksMaxItems
```

## See also

- [Tasks](tasks.md) and [Signifiers](signifiers.md) — the preview features whose settings are summarised above; both are managed through their own settings tabs rather than by hand-editing.
- [Per-folder layer in the architecture docs](../settings-resolution.md) — developer-focused notes on the resolver and key-case conversion.
- [Plugin source — `JournalFolderSettings`](../../src/data-access/journal-folder-settings.type.ts) — authoritative type definition with per-field JSDoc rationale.
