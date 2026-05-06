# Developer notes

## Commands

```bash
npm install
npm run dev        # esbuild watch → main.js (inline sourcemap)
npm run build      # type-check + production build
npm test           # vitest run
npm run test:watch # vitest watch
```

`CLAUDE.md` documents the architecture in more detail (plugin shell → feature set, settings resolution, the calendar/header components). It's worth a read if you're making non-trivial changes.

## Local testing with an external vault

1. Create a symlink to the project in the vault.

```shell
ln -s "$(pwd)" "/${path-to-vault}/.obsidian/plugins/journal-folder"
```

2. Run devmode

```shell
npx npm run dev
```

3. (Recommended) Install the [Hot Reload](https://github.com/pjeby/hot-reload) plugin in the same vault so `journal-folder` reloads automatically whenever esbuild rewrites `main.js`.

## Simulating mobile on desktop

The plugin reads `Platform.isMobile` (not viewport width), so just narrowing the desktop window doesn't trigger the mobile layout — the calendar will collapse to a single month at narrow widths but cells stay desktop-sized. To get genuine mobile rendering (touch-sized cells, mobile chrome, mobile-only defaults), use Obsidian's built-in emulation toggle:

1. Open DevTools — `View → Toggle Developer Tools` (or `Cmd+Option+I` / `Ctrl+Shift+I`).
2. Switch to the **Console** tab and run:

   ```js
   app.emulateMobile(true)
   ```

   The whole UI re-renders into mobile mode; the active leaf is reset to a "New tab" placeholder, so re-open whatever note you were on. The plugin picks up `isMobile = true` on the next mount.
3. To go back to desktop:

   ```js
   app.emulateMobile(false)
   ```

   Mobile-only state (e.g. `workspace-mobile.json`) is left behind in `.obsidian/`; the demo vault `.gitignore` excludes that file.

## Regenerating the screenshots

The screenshots in the project README are captured from a real Obsidian session against the demo vault at `docs/demo-vault/`. The vault has the plugin pre-installed, both Atlas and Personal journal folders set up, and dates fixed at 2026-05-04 / 2026-05-05 so the demo world stays stable. To re-capture after a UI change:

1. Sync the current build into the demo vault:

   ```bash
   cp main.js styles.css manifest.json docs/demo-vault/.obsidian/plugins/journal-folder/
   ```

2. Open the demo vault:

   ```bash
   open "obsidian://open?path=$(pwd)/docs/demo-vault"
   ```

3. For each scenario, navigate to the relevant note (e.g. `Project — Atlas/2026-05-04`), set the calendar/popover state you want, and capture the rendered area with `screencapture -R x,y,w,h`. Crop with `sips --cropOffset y x -c h w`. The mobile shot uses Obsidian's `app.emulateMobile(true)` toggled from DevTools — see *Simulating mobile on desktop* above.

### Practical tips for automated capture

The naive flow above relies on doing each screenshot by hand. If you (or an LLM driving Obsidian) want to script the run, these are the gotchas worth knowing:

- **Window positioning.** The README's existing PNGs are captured at the Obsidian default readable line length (760pt logical → 1520px Retina wide). Position the window at a known origin (e.g. `(0, 30)` size `1600x1770`) and capture the editor pane, not the whole window. With sidebar at ~340pt the pane center sits at `x = 972`, so a 760-wide capture starts at `x = 592`.
- **Find chip positions dynamically.** AppleScript via System Events exposes the `Today` chip (`AXLink` with `description "Today"`) on every header tier. Use it as the anchor — its `y` is the chip-row baseline. The `More...` chip is *not* exposed as a separate AX role, but its center sits roughly at `Today.x - 39` (back-chip + arrow + half of "More..." width). Querying Today on every navigation keeps the click coordinates correct as the chip-row composition shifts (e.g. monthly's `Apr`/`Jun` vs daily's `Sun, 3 May`/`Tue, 5 May`).
- **AppleScript `click` / `AXPress` does NOT fire Svelte handlers.** The `More...` chip is a `<span role="button">` with an `onclick` handler — Accessibility-API clicks won't toggle it. Drive a real `CGEvent` mouse click instead (a few-line Swift helper using `CGEvent(mouseEventSource: ..., mouseType: .leftMouseDown/.leftMouseUp, ...)` works). Same applies to the portaled popover's `Show calendar` / `Hide calendar` link.
- **Park the cursor before non-popover captures.** After a `CGEvent` click, the cursor stays on the clicked element. The next non-popover capture (e.g. `calendar-3-months.png`) ends up with the More chip in `:hover` state. Move the cursor to a neutral spot (e.g. far down the file-tree sidebar) before capturing.
- **Toggling `quartersEnabled` via `data.json`.** Editing `docs/demo-vault/.obsidian/plugins/journal-folder/data.json` triggers Obsidian's `onExternalSettingsChange`, but the rendered pane keeps its previous output until the code-block processor re-runs. Switch to a different note (or back to the same one via `obsidian://open`) to force a fresh render with the new settings.
- **Calendar visibility is in-memory.** `calendarVisible` lives in a Svelte `writable` store with a `userHasToggled` flag — once toggled in the running session, the data.json `default-calendar-visible-*` is ignored. To switch state mid-script you have to actually click `Show calendar` / `Hide calendar` in the popover. The toggle link is portaled to `<body>`, isn't in the AX tree, and on a 760-wide pane sits roughly at `(1280, Today.y + 48)`.
- **Capture heights for the existing PNGs** (logical pt; double for the Retina PNG):
    - headers with folder title: `760×183`
    - `header-no-folder-title.png`: `760×140`
    - `more-popover-daily.png`: `760×240`
    - `more-popover-weekly.png`: `760×350`
    - `more-popover-monthly.png` (calendar visible): `760×322`
    - `more-popover-yearly-quarters.png`: `760×360`
    - `calendar-*` desktop shots: `760×400`
    - `calendar-mobile.png`: `420×525`, captured under `app.emulateMobile(true)`
- **Mobile resets the active leaf.** `app.emulateMobile(true)` re-mounts the workspace into a "New tab" placeholder, so re-`obsidian://open` the note you want before capturing. The window/pane geometry also changes — the chip row moves, so requery `Today` after switching.
