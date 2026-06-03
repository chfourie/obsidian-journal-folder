# Using with the Obsidian Tasks plugin

The community **[Tasks](https://publish.obsidian.md/tasks/)** plugin (`obsidian-tasks-plugin`) and Journal Folder coexist on the same checkbox alphabet. They were designed independently, so a few configuration choices keep them from stepping on each other.

> [!IMPORTANT]
> Journal Folder's task surfaces are **present-only** and date-driven by the source note's filename. The Tasks plugin's query language (due dates, scheduled dates, recurrence, priorities, tags, paths) is far richer. The two are complementary: use Journal Folder's sidebar panel and `journal-tasks` blocks to surface what's on the current day/week/month at a glance; use Tasks-plugin queries for due-date filtering, recurrence, and global rollups.

## Sharing the same checkbox alphabet

The Tasks plugin reads (and writes) the same characters Journal Folder's built-in templates do:

| Char | Meaning |
| --- | --- |
| `[ ]` | open / todo |
| `[/]` | in progress |
| `[x]` | done |
| `[>]` | forwarded / migrated |
| `[-]` | cancelled |

If you pick the **Bullet Journal** or **Kanban** template as the starting point for a flow (and leave the characters at their defaults), notes are interchangeable — the Tasks plugin can query them, and Journal Folder can render them in the sidebar.

## Recommended setting: leave `task-interaction-scope` on `lists`

When both plugins are installed, leave Journal Folder's **`task-interaction-scope`** on its default value of **`lists`**. This means:

- Journal Folder's icon rendering and click-cycle apply only inside the plugin's own surfaces (sidebar panel + `journal-tasks` blocks).
- Document-body checkboxes everywhere else are left to Obsidian and the Tasks plugin to render and handle.

That avoids two plugins both trying to intercept the same click on the same checkbox in the same document.

If you want Journal Folder's rendering to apply everywhere, set the scope to `everywhere` — but expect the Tasks plugin's hover preview, edit modal, and query rendering to behave differently on those rows. They aren't strictly incompatible; they just compete for the same DOM.

## Status state mapping

Journal Folder's `isDone` flag and the Tasks plugin's *Status Settings* control the "done" concept independently. If you want both plugins to treat `[>]` and `[-]` as done:

- **In Journal Folder:** make sure the status's `isDone` is `true` in the flow editor — the built-in templates already set this.
- **In Tasks plugin:** under *Status Settings*, set both characters' *Status Type* to `DONE` (or `CANCELLED`, which Tasks treats as terminal for query purposes).

## Cycle order

The Tasks plugin's own *Cycle through tasks*** command cycles statuses in the order configured in *Status Settings*. Journal Folder's per-status **next** field is independent — it only drives the click cycle inside the plugin's own surfaces. Configure both if you want consistent behaviour from both keyboard (Tasks plugin command) and mouse-click (Journal Folder surfaces).

## Tasks-plugin metadata

The Tasks plugin appends emoji metadata (e.g. `📅 2026-06-15`, `⏫`, `🔁 every week`) to the task text on disk. Journal Folder keeps that text verbatim — it doesn't parse or hide the metadata, and clicking the status icon to cycle preserves it. Rows render with the metadata visible in the sidebar; if you want it hidden, your theme's CSS is the place to do it.

## Queries vs. `journal-tasks`

The two block types target different needs and can both live in the same note:

- **`tasks` block (Tasks plugin)** — query by metadata (`due before next week`, `priority is high`, `path includes Project`).
- **`journal-tasks` block (Journal Folder)** — surface tasks from journal notes whose date range intersects the host note's range.

A weekly review note can hold both: a `journal-tasks` block at the top to list everything written down during the week, and a Tasks-plugin block below it for `due before tomorrow` rollups.
