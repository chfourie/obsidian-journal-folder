# The journal header

Every journal note gets a header by including a `journal-header` code block at the top:

````markdown
%% EDITING %%
```journal-header
```
````

That's it. The plugin replaces the code block with a rendered header keyed off the note's filename. The leading `%% EDITING %%` comment is optional but recommended — without it, opening a note in edit mode lands the cursor on the code block, which causes the rendered header to flicker into source until you click away. With the comment, the cursor lands on the comment line first; reading view drops the comment entirely and renders the header at the very top.

> [!TIP]
> Use the [Templater](https://silentvoid13.github.io/Templater/) plugin (or the core *Templates* plugin) to inject this block automatically into new notes — or turn on the plugin's own [*Auto-fill new journal notes*](auto-template.md) feature.

## What the header shows

### Daily note

![Daily note header](../screenshots/header-daily.png)

The primary row shows: backward chip, **More…** button, *Today* (only if the note isn't today), forward chip. The folder title at the top is optional (see *Folder title* below).

- **Backward link** — closest existing earlier daily note, or the note for the previous day if it doesn't exist yet but the date is today/future. Otherwise omitted.
- **Forward link** — symmetric: closest existing later daily note, or the next day if today/future.
- **Today** — links to today's daily note; only shown when the current note isn't today.
- **More…** — opens the popover (next section).

### Weekly note

![Weekly note header](../screenshots/header-weekly.png)

Backward/forward chips become weeks; *Today* always renders.

### Monthly note

![Monthly note header](../screenshots/header-monthly.png)

Backward/forward chips become months; *Today* always renders.

### Yearly note

![Yearly note header](../screenshots/header-yearly.png)

Backward/forward chips become years; *Today* always renders.

### Without a folder title

If no folder title is configured, the row above the H1 is simply omitted:

![Header with no folder title](../screenshots/header-no-folder-title.png)

## The More popover

The chips on the primary row are deliberately minimal. Higher-order period jumps and lower-order period lists live in the *More…* popover so the bar stays uncluttered.

### From a daily note

![More popover, daily note](../screenshots/more-popover-daily.png)

The **Jump to** section lists higher-order periods that contain the current note: year (`2026`), month (`May`), week (`W19`). For unspanning periods each link is shown only if a note exists for that period or if the period is current/future; when the current note straddles a tier boundary (e.g. a week that crosses March/April) all overlapping periods are listed, with past+missing entries rendered inactive. The **Show calendar** / **Hide calendar** toggle on the right opens or closes the inline calendar picker (see [Calendar picker](calendar.md)).

### From a weekly note

![More popover, weekly note](../screenshots/more-popover-weekly.png)

A weekly note also exposes a **Day** section listing each day in the week, with the same exists/present/future filter applied to each link.

### From a monthly note

![More popover, monthly note (calendar visible)](../screenshots/more-popover-monthly.png)

A monthly note's lower-order section is **Week**; a yearly note's is **Month**. On yearly notes the *Jump to* section is empty (no higher-order periods exist), so the calendar toggle moves to the *Month* header on the right. The toggle reads *Hide calendar* here because the calendar is currently visible.

## Folder title resolution

The header's folder-title row is resolved as:

1. If `journal-folder-title` is configured (folder or embedded), use it.
2. Else if `use-folder-name-as-default-title` is true, use the folder's actual name.
3. Else omit the row entirely.
