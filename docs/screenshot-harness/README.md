# Screenshot harness

How the screenshots in the project README are generated, why it works this way, and how to extend it.

## TL;DR

```bash
# from the repo root
node docs/screenshot-harness/render.mjs
```

That writes every PNG referenced by the README into `docs/screenshots/`. The script is fully self-contained — no Obsidian, no GUI, no permissions.

## Why not screenshot Obsidian directly?

We tried. There were two blockers:

1. **macOS Screen Recording permission.** `screencapture` (and any equivalent automation) needs the *Screen Recording* privacy permission for the calling app. Granting that permission requires a user interaction that an autonomous Claude Code session can't perform. Without it, you get `could not create image from display`.
2. **Accessibility permission for AppleScript window inspection.** Same problem — without the user clicking a *Grant* dialog, `osascript` can't read window IDs or positions.

Even with both permissions granted, you still hit issues:

- Obsidian's UI chrome (sidebars, tabs, status bar) leaks into shots and dates them quickly.
- Toggling the More popover or the calendar requires simulated clicks at known coordinates, which are fragile across themes and font sizes.
- Light mode is a vault-level setting, so every shot of an unrelated vault would need a config swap.

## What we do instead

The plugin's UI is plain HTML/CSS — Svelte just produces DOM nodes. So we render that DOM directly:

1. Static HTML pages in `_pages/` (regenerated each run) load:
   - The plugin's real `styles.css` (so screenshots stay accurate when CSS changes).
   - `obsidian-light.css`, a hand-curated stand-in for Obsidian's default light theme — defines `--text-accent`, `--background-primary`, `--interactive-accent`, etc. with values matching the stock Obsidian "Default" theme in light mode.
2. Each page contains a `#stage` element that wraps a hand-rendered HTML mock of one scenario (a daily header, a popover open from a weekly note, the calendar with three months visible, etc.). The HTML mirrors the structure of `JournalHeader.svelte` and `JournalCalendar.svelte` exactly — same class names, same nesting.
3. Playwright (Chromium, headless) opens each page and uses `locator('#stage').screenshot()` to capture just the stage element. No viewport sizing, no cropping — Playwright tightly bounds the screenshot to the stage's bounding box.
4. PNGs land in `docs/screenshots/`, ready for the README.

`deviceScaleFactor: 2` gives retina-quality output without any resampling.

## Trade-offs

- **The mock HTML can drift.** If you change the structure produced by `JournalHeader.svelte` or `JournalCalendar.svelte`, you have to update the renderers in `render.mjs` to match. We rely on `styles.css` being shared — selectors stay accurate.
- **No surrounding Obsidian chrome.** The screenshots show the plugin output on a clean white background instead of inside an editor pane. This is intentional: it's tighter, doesn't date with Obsidian UI changes, and matches what the user actually cares about (the plugin's contribution).
- **The "More popover" is rendered inline.** In the live plugin it's `position: fixed` and portaled to `<body>` so CodeMirror widget clipping doesn't eat it. The harness drops it inline with `position: static; margin-top: 6px` so the screenshot crops cleanly. The visual result is identical.

## File layout

```
docs/screenshot-harness/
├── README.md            # this file
├── render.mjs           # the harness — scenarios + driver in one file
├── obsidian-light.css   # Obsidian-light CSS variable stand-in
└── _pages/              # generated each run; safe to delete
    ├── header-daily.html
    ├── ...
```

## Adding a new scenario

1. Open `render.mjs` and append an entry to `SCENARIOS`. Each entry needs:
   - `name` — used as both the HTML filename and the PNG filename (no extension).
   - `stageWidth` — the CSS width of the stage div. Use 760 for header/calendar shots, 420 for mobile.
   - `html()` — returns a complete HTML page string. Compose using the existing renderers (`renderHeader`, `renderMorePopover`, `renderCalendar`) plus `pageHTML`.
2. If the scenario needs a new piece of plugin UI not yet covered (modals, error states, settings tab), add a renderer beside the existing ones. Mirror the Svelte template structure faithfully — same classes, same nesting.
3. Run `node docs/screenshot-harness/render.mjs` and verify the PNG.
4. Reference `docs/screenshots/<name>.png` from `README.md`.

## Adjusting the demo data

The "demo world" lives at the top of `render.mjs`:

```js
const TODAY = moment('2026-05-04')
const EXISTING_NOTES = new Set([ ... ])
const FOLDER_TITLE = 'Atlas Migration'
```

Anything in `EXISTING_NOTES` renders as an existing-note cell in the calendar; anything else is missing/past-empty. If you change `TODAY`, update `EXISTING_NOTES` to keep the past/present/future mix interesting.

## The companion demo vault

`docs/demo-vault/` is a real Obsidian vault with the plugin pre-installed and the same demo dates as the harness. It's not used by the screenshot script — it's a manual-testing aid. To open it:

```bash
open "obsidian://open?path=$(pwd)/docs/demo-vault"
```

(macOS — equivalent works on Windows/Linux via the `obsidian://` URL scheme). The vault is set to light mode, has the plugin enabled, and contains journal notes for the *Project — Atlas* and *Personal* folders. Useful when reviewing live behaviour or capturing additional shots manually.

## Dependencies

- `playwright` — installed as a dev dep when needed (`npm install --no-save playwright && npx playwright install chromium`). Not in `package.json` because it's only used by this harness.
- `moment` — already a transitive dep via the plugin's runtime.

If `playwright` isn't installed and you run the harness, the script fails with a clear `Cannot find package 'playwright'` error — install it then retry.
