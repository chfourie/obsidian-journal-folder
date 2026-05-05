# Header UI rendering (Svelte 5)

`JournalHeaderFeature.load` registers a `journal-header` code block processor. For each occurrence:

1. Resolve settings for the current file (with the code block body as embedded config).
2. Build a `JournalNote` via the factory.
3. `buildJournalHeaderInfo(settings, note)` produces a plain `JournalHeaderInfo` containing the title, `backwardLink` / `forwardLink` / `todayLink` chips for the primary row, plus `moreLinks` (higher-order period chips) and `secondaryLinks` (lower-order period entries) with their respective labels (`moreLinksLabel`, `secondaryLinksLabel`).
4. `mount(JournalHeader, { target: el, props: { info, note, confirmCreate, navigate, defaultCalendarVisible } })` — Svelte 5 `mount` API, components use runes (`$props()`). The feature also constructs a `confirmCreate` (opens the `ConfirmCreateModal`) and a `navigate` callback (`workspace.openLinkText`) so the calendar can intercept clicks on past-missing cells without losing native link behavior elsewhere.

Errors are caught and rendered via the `ErrorMessage.svelte` component instead of being thrown.

## Primary row and the More popover

The primary row shows only `back ‹‹ More... · Today · ›› forward`. Everything else lives in the **More popover**: a "View" section header with the higher-order chips below it and a "Show calendar" / "Hide calendar" link right-aligned on the same row, plus a separate lower-order section ("Day"/"Week"/"Month"/"Year"). The popover is **portaled to `document.body`** when open and positioned with `getBoundingClientRect()` on the options bar; this is intentional — in live-preview mode the CodeMirror widget wrapping the code block clips absolutely-positioned descendants, so the panel has to escape the widget's containing block. Repositioning runs on window resize and on capture-phase `scroll` events (the editor pane scrolls separately from the window).

Because the panel is portaled out of the markdown render container, Obsidian's `.internal-link` click interception no longer fires on its links (that handler is scoped to the rendered markdown). The panel installs its own delegated `onclick` that uses `findInternalLinkHref` (in `internal-link-target.ts`) to walk up to the nearest `<a class="internal-link">`, then closes the popover and routes the href through the injected `navigate` callback — the same callback the calendar uses for past-missing cells. Primary-row chips don't need this: they stay inside the rendered markdown container where Obsidian's handler still fires.

## Secondary list patterns

Secondary list date patterns are derived from the lower-order `timeUnit` and use non-breaking spaces; they intentionally drop the year because the H1 already shows it. Don't reach for the user-configured `titlePattern`/`shortTitlePattern` for these — see `secondaryTitlePatternFor` in `journal-header-info.ts`.
