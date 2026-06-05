# Tasks (preview)

> [!WARNING]
> **Task management is a preview feature.** It is shipped as a working preview while we iterate on the model — behaviour, settings keys, and persisted data shapes may change between releases, and your configured task flows may need to be re-created across an upgrade. Fresh installs default to interacting only with the plugin's own task lists ([see *Scope of task interactions*](#scope-of-task-interactions)) so existing vaults aren't silently changed.

The tasks feature surfaces Markdown tasks (`- [ ] …` / `- [x] …` and friends) from your journal notes in three places:

1. A panel below the calendar in the **sidebar tab**.
2. A slim **Tasks-only sidebar** (its own view, opened from the *list-checks* ribbon icon).
3. An in-note **`journal-tasks` code block**, analogous to `journal-header`.

A task shows up wherever its source note's date range intersects the **reference window** you're viewing. In the sidebar you choose that window with two controls — an *anchor* (today, or the note you're currently in) and a *range* (day / week / month / quarter / year, or *All* for no date filter); see [Sidebar task panel](#sidebar-task-panel). There's no completion-date stamping — a task's position comes purely from the note it lives in.

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

![Tasks tab — overview with flow list](../screenshots/settings-tasks-overview.png)

Drilling into a flow opens an editor with apply-template / save-as / delete actions and the status list. Each status can be drilled into further for per-status appearance.

![Flow detail — status list](../screenshots/settings-tasks-flow-detail.png)

![Status detail — basics + icon + shell](../screenshots/settings-tasks-status-detail.png)

## Sidebar task panel

When *Show task panel in sidebar* is on, the sidebar tab grows a tasks section below the calendar:

![Sidebar tasks panel](../screenshots/sidebar-tasks-panel.png)

The panel header shows the task count on the left and a **Scope ▾** link on the right. Below it a read-only summary line shows the current selection at a glance — `Anchor · Range · Folders · Filter`, e.g. `Today · Week · All folders · Active`. Click **Scope ▾** to open the scope panel, which has four sections:

- **Anchor** — *Today* (measure from the current date) or *Current note* (measure from the journal note you're reading; falls back to today on a non-journal leaf).
- **Range** — *Day / Week / Month / Quarter / Year* lists tasks whose notes fall in the calendar period of that size around the anchor; *All* drops date filtering entirely (every task in the chosen folders). *Quarter* appears only when quarterly notes are enabled.
- **In folders** — *Current note's folder*, *All journal folders*, or a single specific folder. This is independent of the anchor, so you can, say, show *this week* across *all folders*, or *all* tasks in *just the current note's folder*.
- **Filter** — *Show completed tasks* toggles whether statuses whose `isDone` is true appear; the header surfaces the hidden count when they're hidden.

Changes apply immediately and the panel stays open so you can adjust several at once. The **Tasks-only sidebar** has the same panel with its own independent selection.

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

## Migrating tasks between notes

Bullet-journal style, *migration* moves an unfinished task from one note to
another **within the same folder** — say, rolling today's leftovers onto
tomorrow, or a week's open items up into the next week. It doesn't just move
text; it leaves a trail in both directions.

When you migrate one or more tasks:

1. The **origin** line is stamped with the flow's *migrated* status (an inactive
   status such as `[>]`) so it reads as moved, not done, and drops out of active
   lists.
2. A **copy** is written into the destination note at the position you've
   configured (see below), as a fresh top-level task.
3. **Cross-references** are added so you can hop between the two: a *forward*
   reference on the origin pointing at the destination, and a *back* reference
   on the copy pointing at the origin.

![Migration reference in reading view](../screenshots/task-migration-reading.png)

In reading view each reference renders as a small marker plus a link, faded to
the background (full opacity on hover) so the note stays readable. The plugin's
own task lists strip the reference markers from the displayed text.

### Triggering a migration

Three entry points, all scoped to a single folder:

- **Per-task** — right-click a task (editor menu) → *Migrate this task…*.
- **From this note / To this note** — the file menu (⋯) offers *Migrate
  tasks from this note…* and *…to this note*, which open a grouped multi-select
  picker. Nothing is selected by default — tick the tasks you want and confirm.

![Migration picker](../screenshots/migration-picker.png)

### Settings

Migration is configured under *Settings → … → Journal Folder → Tasks* (and the
placement keys are also honoured per-folder, since they're a per-note layout
concern):

- **Migration placement / heading** — where copies land in the destination:
  *After the last task*, *Top of note*, *End of note*, or *Under a heading* (with
  the heading text you specify).
- **Reference on the original task** / **Reference on the migrated copy** —
  toggle either direction off if you only want one trail.
- **Reference style** — *text*, *emoji*, or *lucide* (the default; markers are
  stored as `lucide:<name>` tokens and rendered as icons in reading view). Each
  style has editable *to* / *from* markers (the defaults are redo/undo arrows).
- **Reference opacity** — how faded the references render (default 30%).

## Scope of task interactions

`task-interaction-scope` controls where the plugin's task-icon rendering and click handling apply:

- **`lists`** (default for new installs) — only inside the plugin's own task surfaces: the sidebar panel and `journal-tasks` blocks. Document-body checkboxes are left to Obsidian's native rendering and click behaviour, so existing vaults keep behaving as they always have.
- **`everywhere`** — the plugin also intercepts every task checkbox in the rendered document, both in reading view and live preview. Useful if you want the custom shell/icon and configured cycle to apply uniformly across the vault. Opt in only if you understand that other plugins (notably the Obsidian Tasks plugin) and themes may compete for the same DOM.

This is a **global-only** setting — interception happens at process-wide layers, so per-folder and embedded overrides are ignored.

## Tasks plugin and theme interop

The community-conventional checkbox alphabet (`[ ]` `[/]` `[x]` `[>]` `[-]` `[d]` `[?]`) is exactly what most theme/plugin ecosystems read, so notes stay portable. See:

- [Using with a theme that styles tasks](themes-with-tasks.md)
- [Using with the Obsidian Tasks plugin](obsidian-tasks-plugin.md)
