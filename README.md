# Journal Folder

An Obsidian community plugin that turns *any* folder in your vault into a journal. Drop a note named `2026-05-04.md` (or `2026-W19.md`, `2026-05.md`, `2026.md`) into a folder, add a one-line code block at the top, and the plugin renders a navigable header, an inline calendar picker, and a sidebar with everything in reach.

You can run as many independent journals as you like in the same vault. A folder per project, a folder for personal notes, a folder per client — each gets its own settings, its own sequence of notes, and its own header.

![Bird's-eye view: a daily journal note rendered by the plugin, with the journal-folder sidebar tab open on the right](docs/screenshots/hero-overview.png)

## What you get

- **A navigable header** in every journal note — backward / forward chips, a *Today* link, a *More…* popover for higher-order period jumps, and an optional inline calendar. [Read more →](docs/usage/headers.md)
- **A calendar picker** that mirrors your whole journal — existing / missing / today / current-note states, fold-out month grid, configurable defaults per platform. [Read more →](docs/usage/calendar.md)
- **A sidebar tab** with folder picker, calendar, and one-click access to every journal-folder action — *Switch to default*, *Set as default*, *Edit folder configuration*, *Initialise a new journal folder*. [Read more →](docs/usage/sidebar.md)
- **Auto-fill new journal notes** with a per-folder or per-tier template, so you don't need Templater just to inject the `journal-header` block. [Read more →](docs/usage/auto-template.md)
- **Quarterly notes** as an opt-in fifth tier between yearly and monthly. [Read more →](docs/usage/quarters.md)
- **Tasks (preview)** — surface Markdown tasks from journal notes in the sidebar panel or in any note via a `journal-tasks` code block, with user-defined task flows and a scope picker (anchor × range + folder) for choosing exactly which tasks appear. [Read more →](docs/usage/tasks.md)

## Why folder-based?

Most journaling plugins assume one global daily-notes folder. *Journal Folder* assumes nothing about *where* journals live or *how many* you keep. Conventions that hold:

- A note's basename is its date. Filename formats are fixed; everything else (title, link labels, calendar visibility, folder title) is configurable.
- Settings cascade from global → folder → embedded. Per-folder overrides live in `journal-folder.md`; per-header overrides live inside the code block.
- The plugin only acts on files matching the date conventions, so the rest of the folder's contents are ignored.

The vault root is **not** supported as a journal folder — Obsidian's link resolution behaves differently there.

## Recognised file names

| Note type | Filename format | Example |
| --- | --- | --- |
| Daily     | `YYYY-MM-DD` | `2026-05-04.md` |
| Weekly    | `gggg-[W]ww` | `2026-W19.md`   |
| Monthly   | `YYYY-MM`    | `2026-05.md`    |
| Yearly    | `YYYY`       | `2026.md`       |

The weekly format uses ISO week-year (`gggg`/`gg`). If you customise weekly title patterns, use `gg`/`gggg` for the year — `YYYY` or `GGGG` will desync the displayed year from the filename around year boundaries.

A fifth tier — quarterly notes (`YYYY-Q[1-4]`) — is available as an opt-in. See [Quarterly notes](docs/usage/quarters.md).

## Install

The plugin is published to the Obsidian community plugin directory under the name **Journal Folder**. Open *Settings → Community plugins → Browse*, search for it, install, and enable.

To run from source, clone this repo and:

```bash
npm install
npm run build      # tsc --noEmit + production esbuild → main.js
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/journal-folder/`.

## Getting started

1. Pick a folder in your vault for your journal (e.g. `Personal`, `Project — Atlas`, …). The vault root isn't supported — make it a real folder.
2. Open the sidebar (calendar ribbon icon on the left), click the **More...** link, and choose **Initialise a new journal folder**. Pick your folder.
3. The plugin creates a `journal-folder.md` in that folder. Click any cell on the calendar to create your first daily/weekly/monthly note — it gets the `journal-header` block automatically if you've turned on *Auto-fill new journal notes*.
4. Open the new note. You should see the rendered header at the top.

Once you have one journal folder, repeat the *Initialise* step for any other folder you want as a journal — each can have its own settings.

## Working with other plugins and themes

- **Themes that style task checkboxes** (Minimal, Things, AnuPpuccin, Border, …) coexist via per-status *theme* rendering. [Read more →](docs/usage/themes-with-tasks.md)
- **The Obsidian Tasks plugin** shares the same checkbox alphabet; keep `task-interaction-scope` on `lists` so both plugins stay out of each other's way. [Read more →](docs/usage/obsidian-tasks-plugin.md)
- **Templater** with *Folder Templates* is the cleanest way to inject the `journal-header` block automatically if you'd rather not use the plugin's built-in auto-template.

## Configuration

Almost every setting can be edited from one of two UIs:

- **Global defaults** — *Settings → Community plugins → Journal Folder*.
- **Per-folder overrides** — sidebar tab → **More… → Edit folder configuration**.

The same form drives both, with global-only sections hidden in folder mode. Edits are stored sparsely in per-folder front matter, so fields that match the global default fall through automatically when you change the global default later.

For the underlying data structures, manual front-matter / `data.json` editing, and embedded-block syntax, see [Advanced configuration](docs/usage/advanced-configuration.md). That page is the right reference if you're scripting setup across multiple vaults, storing config in source control, or overriding a single header from inside the note itself — but for day-to-day use, the settings UIs are the recommended path.

## Documentation index

User guides (start here):

- [The journal header](docs/usage/headers.md)
- [The calendar picker](docs/usage/calendar.md)
- [Sidebar tab](docs/usage/sidebar.md)
- [Auto-fill new journal notes](docs/usage/auto-template.md)
- [Quarterly notes (opt-in)](docs/usage/quarters.md)
- [Tasks (preview)](docs/usage/tasks.md)
- [Using with a theme that styles tasks](docs/usage/themes-with-tasks.md)
- [Using with the Obsidian Tasks plugin](docs/usage/obsidian-tasks-plugin.md)
- [Advanced configuration](docs/usage/advanced-configuration.md)

Developer / contributor docs:

- [Developer notes](docs/developer-notes.md) — build commands, local-vault setup, screenshot harness
- [Settings resolution](docs/settings-resolution.md)
- [Journal note model](docs/journal-note.md)
- [Header UI internals](docs/header-ui.md)
- [Calendar internals](docs/calendar.md)
- [Sidebar internals](docs/sidebar.md)
- [Auto-template internals](docs/auto-template.md)
- [Tasks design](docs/tasks-design.md)

## License

GPL-3.0 — see `LICENSE.md`.
