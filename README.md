# Journal Folder

An Obsidian community plugin that turns *any* folder in your vault into a journal. Drop a note named `2026-05-04.md` (or `2026-W19.md`, `2026-05.md`, `2026.md`) into a folder, add a one-line code block at the top, and the plugin renders a navigable header — backward/forward chips, a *Today* link, a *More…* popover with higher-order period jumps, and an optional inline calendar picker.

You can run as many independent journals as you like in the same vault. A folder per project, a folder for personal notes, a folder per client — each gets its own settings, its own sequence of notes, and its own header.

![Daily note header rendered by the plugin](docs/screenshots/header-daily.png)

---

## Why folder-based?

Most journaling plugins assume one global daily-notes folder. *Journal Folder* assumes nothing about *where* journals live or *how many* you keep. Conventions that hold:

- A note's basename is its date. Filename formats are fixed; everything else (title, link labels, calendar visibility, folder title) is configurable.
- Settings cascade from global → folder → embedded. Per-folder overrides go in `journal-folder.md`; per-header overrides go in the body of the code block.
- The plugin only acts on files matching the date conventions, so the rest of the folder's contents are ignored.

The vault root is **not** supported as a journal folder — Obsidian's link resolution behaves differently there.

## Recognised file names

| Note type | Filename format | Example |
| --- | --- | --- |
| Daily   | `YYYY-MM-DD` | `2026-05-04.md` |
| Weekly  | `gggg-[W]ww` | `2026-W19.md`   |
| Monthly | `YYYY-MM`    | `2026-05.md`    |
| Yearly  | `YYYY`       | `2026.md`       |

The weekly format uses ISO week-year (`gggg`/`gg`). If you customise weekly title patterns, use `gg`/`gggg` for the year — `YYYY` or `GGGG` will desync the displayed year from the filename around year boundaries.

## Install

The plugin is published to the Obsidian community plugin directory under the name **Journal Folder**. Open *Settings → Community plugins → Browse*, search for it, install, and enable.

To run from source, clone this repo and:

```bash
npm install
npm run build      # tsc --noEmit + production esbuild → main.js
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/journal-folder/`.

---

## The journal header

Every journal note gets a header by including a `journal-header` code block at the top:

````markdown
%% EDITING %%
```journal-header
```
````

That's it. The plugin replaces the code block with a rendered header keyed off the note's filename. The leading `%% EDITING %%` comment is optional but recommended — without it, opening a note in edit mode lands the cursor on the code block, which causes the rendered header to flicker into source until you click away. With the comment, the cursor lands on the comment line first; reading view drops the comment entirely and renders the header at the very top.

> [!TIP]
> Use the [Templater](https://silentvoid13.github.io/Templater/) plugin (or the core *Templates* plugin) to inject this block automatically into new notes in each journal folder.

### What the header shows

#### Daily note

![Daily note header](docs/screenshots/header-daily.png)

The primary row shows: backward chip, **More…** button, *Today* (only if the note isn't today), forward chip. The folder title at the top is optional (see *Folder title* below).

- **Backward link** — closest existing earlier daily note, or the note for the previous day if it doesn't exist yet but the date is today/future. Otherwise omitted.
- **Forward link** — symmetric: closest existing later daily note, or the next day if today/future.
- **Today** — links to today's daily note; only shown when the current note isn't today.
- **More…** — opens the popover (next section).

#### Weekly note

![Weekly note header](docs/screenshots/header-weekly.png)

Backward/forward chips become weeks; *Today* always renders.

#### Monthly note

![Monthly note header](docs/screenshots/header-monthly.png)

Backward/forward chips become months; *Today* always renders.

#### Yearly note

![Yearly note header](docs/screenshots/header-yearly.png)

Backward/forward chips become years; *Today* always renders.

#### Without a folder title

If no folder title is configured, the row above the H1 is simply omitted:

![Header with no folder title](docs/screenshots/header-no-folder-title.png)

### The More popover

The chips on the primary row are deliberately minimal. Higher-order period jumps and lower-order period lists live in the *More…* popover so the bar stays uncluttered.

#### From a daily note

![More popover, daily note](docs/screenshots/more-popover-daily.png)

The **View** section lists higher-order periods that contain the current note: year (`2026`), month (`May`), week (`W19`). Each link is rendered only if a note exists for that period or if the period is current/future. The **Show calendar** / **Hide calendar** toggle on the right opens or closes the inline calendar picker (see next section).

#### From a weekly note

![More popover, weekly note](docs/screenshots/more-popover-weekly.png)

A weekly note also exposes a **Day** section listing each day in the week, with the same exists/present/future filter applied to each link.

#### From a monthly note

![More popover, monthly note (calendar visible)](docs/screenshots/more-popover-monthly.png)

A monthly note's lower-order section is **Week**. A yearly note's is **Month** (not shown — you've seen the pattern). The toggle on the right reads *Hide calendar* here because the calendar is currently visible.

### The calendar picker

Toggle the calendar from the More popover and the inline picker appears below the header. It reflects the same exists/missing/today/current state the rest of the plugin uses, so you can see your whole journal at a glance:

![Calendar with three months visible](docs/screenshots/calendar-3-months.png)

Cell rules (apply uniformly across day/week/month/year cells):

- **Missing** — theme's normal text colour, faded at the theme's unresolved-link opacity. Past missing cells are faded an additional 50% so they read as more demoted than future missing cells. Clicking a past missing cell opens a confirmation modal before creating the note (so you don't accidentally create back-dated entries).
- **Existing** — accent colour, bold, underlined.
- **Sundays** — accent colour across every state (existing, future-missing, past-missing) and on the weekday header, so the start of the week is always easy to pick out.
- **Today** — accent ring around the cell.
- **Current note** — filled accent background. Travels with the note's time unit, so opening a monthly note paints the *month* cell, not the day:

![Calendar viewed from a monthly note](docs/screenshots/calendar-from-monthly.png)

Clicking a date that doesn't yet have a note creates it (with a confirm prompt for past dates). Arrows on the sides slide the visible month window by one month at a time.

The strip above the months grid carries two quick-nav controls. **Today** snaps the month window so the current month sits at the anchor — handy when you've scrolled far away. **{Month} {Year}** (the centred label) toggles a date-picker popover with year chevrons (`‹` and `›` shift by ±12 months) and a 4×3 grid of month names; clicking a month jumps the window straight to it. The picker is portaled and clamped inside the viewport, so it doesn't overflow at narrow widths.

The number of visible months is chosen automatically based on the available width, capped at 5. As the pane narrows the picker drops to a single month; on mobile the cells additionally enlarge for easier tapping:

![Calendar at narrow width — single month layout](docs/screenshots/calendar-mobile.png)

You can have the calendar open by default for new sessions — see `default-calendar-visible-desktop` and `default-calendar-visible-mobile` under *Configuration*. The two platforms have independent defaults (calendar on for desktop, off for mobile) because the multi-month layout isn't useful at phone widths. A manual toggle from the More popover wins over any default for the rest of the running Obsidian session, so navigating between folders with different defaults won't override an explicit choice.

---

## Configuration

Settings are resolved in three layers, **last wins**:

1. **Global** — set in *Settings → Community plugins → Journal Folder*. Persists in `data.json`.
2. **Folder** — front-matter of a file named `journal-folder.md` in the same folder as the journal note. Subfolders never inherit from a parent folder's `journal-folder.md` — each folder controls its own settings.
3. **Embedded** — body of the current `journal-header` code block, parsed line-by-line as `key: value`. Applies only to that one header.

Setting names are case-insensitive and tolerant of separators. All of the following are equivalent:

```
journal-folder-title: Atlas Migration
journal_folder_title: Atlas Migration
JOURNAL_FOLDER_TITLE: Atlas Migration
Journal folder title: Atlas Migration
```

### Folder-level overrides

Drop a `journal-folder.md` in the journal folder and put any settings in the front matter:

```markdown
---
journal-folder-title: Atlas Migration
default-calendar-visible-desktop: true
default-calendar-visible-mobile: false
daily-note-title-pattern: dddd, Do MMMM YYYY
---

Notes about this folder go here. The body is ignored by the plugin.
```

> [!CAUTION]
> Anything set at folder level applies to every journal header in that folder, but does *not* affect the actual folder name on disk. `journal-folder-title` is a display label only.

### Per-header overrides (embedded config)

Settings inside a code block override both global and folder settings — but only for that single header:

````markdown
%% EDITING %%
```journal-header
default-calendar-visible-desktop: true
daily-note-title-pattern: dddd, Do MMMM YYYY
```
````

### Settings reference

All title patterns use [moment.js format syntax](https://momentjs.com/docs/#/displaying/format/).

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
| `yearly-note-title-pattern`          | H1 title pattern for yearly notes. Don't include sub-year units. |
| `yearly-note-short-title-pattern`    | Chip/link pattern for yearly notes. |
| `yearly-note-medium-title-pattern`   | Cross-year yearly link pattern (rare; usually identical to short). |
| `journal-folder-title`               | Display title shown above the H1 in the header. Typically set per-folder, not globally. |
| `use-folder-name-as-default-title`   | If true and `journal-folder-title` isn't set, falls back to the folder name. |
| `default-calendar-visible-desktop`   | If true, the calendar picker is open by default on desktop when Obsidian starts. A manual toggle in the current session wins over this. |
| `default-calendar-visible-mobile`    | If true, the calendar picker is open by default on mobile when Obsidian starts. Defaults to false because the multi-month layout isn't useful at phone widths. |

### Folder title resolution

The header's folder-title row is resolved as:

1. If `journal-folder-title` is configured (folder or embedded), use it.
2. Else if `use-folder-name-as-default-title` is true, use the folder's actual name.
3. Else omit the row entirely.

---

## Tips

- **Templater** with the *Folder Templates* feature is the cleanest way to ensure every new note in a journal folder starts with the `journal-header` code block. The core *Templates* plugin works too.
- **Hot-reload during development** — if you're iterating on a custom build, the [Hot Reload](https://github.com/pjeby/hot-reload) plugin will reload `journal-folder` whenever its `main.js` rebuilds.
- **Filename format is fixed.** If you have an existing journal in a different format, rename the files to one of the four supported patterns. The display patterns are entirely up to you; only the filename is rigid.

## License

GPL-3.0 — see `LICENSE.md`.
