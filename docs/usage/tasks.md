# Tasks (preview)

> [!WARNING]
> **Task management is a preview feature.** It is shipped as a working preview while we iterate on the model — behaviour, settings keys, and persisted data shapes may change between releases, and your configured task flows may need to be re-created across an upgrade. Fresh installs default to interacting only with the plugin's own task lists ([see *Scope of task interactions*](#scope-of-task-interactions)) so existing vaults aren't silently changed.

The tasks feature surfaces Markdown tasks (`- [ ] …` / `- [x] …` and friends) from your journal notes in two places:

1. A panel below the calendar in the **sidebar tab**.
2. An in-note **`journal-tasks` code block**, analogous to `journal-header`.

The model is intentionally **present-only**: no past/future buckets, no completion-date stamping. A task shows up wherever its source note's date range intersects the reference range you're viewing.

## Task flows

A **task flow** is a named ordered set of statuses. Each status has:

- A **label** (e.g. *Open*, *In progress*, *Done*).
- A **character** used inside `[ ]` on disk (e.g. ` `, `/`, `x`).
- A **next** target — what the left-click cycle moves to.
- A **rendering** choice — either let the active Obsidian theme draw the checkbox, or have the plugin paint a custom shell + icon + colour.
- An `isDone` flag that drives the *Hide completed* filter.

Four **built-in templates** ship as read-only starting points — apply one to seed or reset a flow:

| Template | Statuses |
| --- | --- |
| **Simple** | `[ ]` `[x]` |
| **Kanban** | `[ ]` `[/]` `[x]` |
| **Bullet Journal** | `[ ]` `[/]` `[x]` `[>]` `[-]` `[d]` |
| **GTD** | `[ ]` `[/]` `[?]` `[x]` |

Flows live globally on the plugin settings — they're defined in *Settings → Community plugins → Journal Folder → Tasks*. Each folder picks **which** flow it uses (via the per-folder *Tasks* tab in the *Edit folder configuration* modal); edits to a flow's statuses propagate to every folder pointing at the same flow.

Drilling into a flow opens an editor with apply-template / save-as / delete actions and the status list. Each status can be drilled into further for per-status appearance (label, character, cycle target, rendering choice, plus per-status shell / icon / colour pickers).

## Sidebar task panel

When *Show task panel in sidebar* is on, the sidebar tab grows a tasks section below the calendar:

![Sidebar tasks panel](../screenshots/sidebar-tasks-panel.png)

Inline link toggles on the panel header:

- **Today / Dynamic** — `Today` filters to today's date; `Dynamic` follows the active journal note's range (falls back to today for non-journal leaves).
- **Show completed / Hide completed** — toggles whether statuses whose `isDone` is true appear in the list. The header surfaces the hidden count when hiding.

The `⋯` menu carries the secondary actions: scope-folder configuration (only meaningful in `Today` mode), and a jump to the plugin settings.

Each row shows the status icon (clickable to cycle, right-click for a full status menu), the task text with internal links live, and a muted chip linking back to the source note (`daily · 2026-06-03`, `weekly · W23`, …). Rows are single-line with full text in the `title` attribute. The list is sorted with daily tasks first, then weekly, monthly, quarterly, yearly — and capped by `tasksMaxItems` (default 200) with a *Showing 200 of 247 — increase limit in settings* footer when truncated.

## In-note `journal-tasks` block

Drop a `journal-tasks` code block into any note and the plugin replaces it with the same task-list component the sidebar uses:

````markdown
```journal-tasks
units: weekly, monthly, quarterly, yearly
```
````

Optional keys (case-insensitive, separators tolerant):

| Key | Default | Notes |
| --- | --- | --- |
| `folders` | host note's folder | Required when the host note isn't itself a journal note. Comma-separated paths. |
| `units` | all tiers (gated by `quartersEnabled`) | Restrict which note tiers are scanned: `daily`, `weekly`, `monthly`, `quarterly`, `yearly`. |
| `show-completed` | `false` | Seeds the view-local *Show completed* toggle. Toggling in the rendered list does **not** persist back to the markdown. |
| `max-items` | global `tasksMaxItems` | Truncation cap for this block. |

Inside a journal note, the **reference range** is the host's range — so a `journal-tasks` block in a weekly note lists tasks from that week's daily notes (plus the weekly itself). Inside a non-journal note, the reference range falls back to today.

## Scope of task interactions

`task-interaction-scope` controls where the plugin's task-icon rendering and click handling apply:

- **`lists`** (default for new installs) — only inside the plugin's own task surfaces: the sidebar panel and `journal-tasks` blocks. Document-body checkboxes are left to Obsidian's native rendering and click behaviour, so existing vaults keep behaving as they always have.
- **`everywhere`** — the plugin also intercepts every task checkbox in the rendered document, both in reading view and live preview. Useful if you want the custom shell/icon and configured cycle to apply uniformly across the vault. Opt in only if you understand that other plugins (notably the Obsidian Tasks plugin) and themes may compete for the same DOM.

This is a **global-only** setting — interception happens at process-wide layers, so per-folder and embedded overrides are ignored.

## Tasks plugin and theme interop

The community-conventional checkbox alphabet (`[ ]` `[/]` `[x]` `[>]` `[-]` `[d]` `[?]`) is exactly what most theme/plugin ecosystems read, so notes stay portable. See:

- [Using with a theme that styles tasks](themes-with-tasks.md)
- [Using with the Obsidian Tasks plugin](obsidian-tasks-plugin.md)
