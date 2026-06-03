# Quarterly notes (opt-in)

Quarters are off by default. Turn them on and the plugin grows a fifth tier — quarterly notes — that slots between yearly and monthly. Everything else (the daily/weekly/monthly/yearly walkthrough in [Headers](headers.md)) keeps working unchanged; the quarter tier is purely additive.

## Enabling

Set `quarters-enabled: true` at any of the three layers:

- **Globally** in *Settings → Community plugins → Journal Folder* (a checkbox).
- **Per folder** in `journal-folder.md`'s front matter (or via the sidebar's *Edit folder configuration* action):

  ```markdown
  ---
  quarters-enabled: true
  ---
  ```

- **Per header** inside a single `journal-header` block:

  ````markdown
  ```journal-header
  quarters-enabled: true
  ```
  ````

Once on, files named `YYYY-Q[1-4]` (e.g. `2026-Q2.md`) are recognised as quarterly journal notes. With it off, those filenames stay inert — they're just regular notes with no header rendering.

## Quarterly note headers

A quarterly note gets the same header treatment as the other tiers. Backward/forward chips become quarters; *Today* always renders.

![Quarterly note header](../screenshots/header-quarterly.png)

## Quarter section in the More popover

On a yearly note, the More popover gains a *Quarter* section listing `Q1`–`Q4` alongside the *Month* list. Each quarter follows the same exists/missing/today/past-faded rules as everything else, and clicking a past+missing quarter prompts before creating the note.

![More popover, yearly note with Quarter section](../screenshots/more-popover-yearly-quarters.png)

The higher-order chain on daily/weekly/monthly notes also gains the containing quarter — a daily note in May 2026 shows year (`2026`), quarter (`Q2`), month (`May`), week (`W19`) in its *Jump to* row. A quarterly note's primary lower-order list is the three months it contains.

## Calendar month-title annotations

Each month title in the calendar gets a `(Q1)`–`(Q4)` suffix so you can see at a glance which quarter you're in.

![Calendar with quarter annotations on month titles](../screenshots/calendar-with-quarters.png)

## Quarterly title patterns

Each tier has its own H1 / chip / cross-year link patterns, exactly like the other tiers. These are only consulted while `quarters-enabled` is on.

| Setting | What it does |
| --- | --- |
| `quarterly-note-title-pattern`        | H1 title pattern for quarterly notes. Don't include sub-quarter units. |
| `quarterly-note-short-title-pattern`  | Chip/link pattern for quarterly notes. Keep it short — multiple chips render side by side. |
| `quarterly-note-medium-title-pattern` | Pattern for quarterly-note links whose target is in a different year than the source — typically the short pattern plus the year, so the year change is explicit. |

The defaults are `YYYY [Quarter] Q` (e.g. `2026 Quarter 2`) for the H1, `[Q]Q` for chips, and `[Q]Q YY` for cross-year links.
