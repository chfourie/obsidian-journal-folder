# Screenshot harness (Obsidian CLI)

Regenerates every PNG under `docs/screenshots/` by driving the **running**
Obsidian instance through the [Obsidian CLI](https://obsidian.md/help/cli) —
no AppleScript, no synthetic hardware clicks, no hand-tuned capture
coordinates. The CLI's `eval` dispatches real DOM events (which fire Svelte
handlers), `dev:screenshot` captures the window, and we crop to a measured
bounding rect with `sips`.

> This replaced an older AppleScript + Swift-`CGEvent` + `screencapture`
> harness. Everything that harness needed a hardware click or an AX query for
> is now a one-line `obsidian eval`. If you're looking for `click.swift` /
> `lib.sh`, they're gone on purpose.

## Files

```
scripts/screenshots/
  capture.mjs      # one shot: open → set mode → setup → measure → screenshot → crop
  regenerate.mjs   # the scenario manifest (which note / state / crop per PNG)
  README.md        # this file
```

## Prerequisites

- **Obsidian ≥ 1.12.7**, running, with the CLI enabled
  (Settings → General → "Command line interface"). Check with `which obsidian`.
- The **demo vault** (`docs/demo-vault/`) open and registered as
  `vault=demo-vault`, in **light mode** (the README shots are light).
- The current build synced into the demo vault:
  `npm run build && npm run push` (or copy `main.js`/`styles.css`/`manifest.json`
  into `docs/demo-vault/.obsidian/plugins/journal-folder/`).
- `sips` (ships with macOS) for cropping.

## Usage

```bash
node scripts/screenshots/regenerate.mjs            # every scenario
node scripts/screenshots/regenerate.mjs header     # only names containing "header"
node scripts/screenshots/regenerate.mjs --list     # list scenario names
```

`regenerate.mjs` shells out to `capture.mjs` per scenario; you can also run a
single ad-hoc shot directly:

```bash
node scripts/screenshots/capture.mjs \
  --note "Personal/2026-05-04" --out header-daily \
  --setup "await ensureCalendar(false)" \
  --rect "union('.journal-folder-header-title','.journal-folder-header-options')"
```

See the header comment in `capture.mjs` for every flag and the JS helpers
available inside `--rect` / `--setup` (`Q`, `QA`, `rectOf`, `union`, `bodyRect`,
`bodyUnion`, `ensureCalendar`, `openMore`, …).

## How it works (and the sharp edges)

- **`eval` fires Svelte handlers.** `el.dispatchEvent(new MouseEvent('click',
  {bubbles:true}))` toggles the More popover, opens the task scope panel, clicks
  a settings tab, etc. — things AX-API clicks could never do. This is why the
  Swift clicker is gone.
- **Crop = measure + `sips`.** `dev:screenshot` writes the whole window at
  Retina (`devicePixelRatio` 2). We `eval` a `getBoundingClientRect` for the
  target, multiply by the dpr, and `sips --cropOffset Y X -c H W`.
- **`plugin:reload`, never `app:reload`.** If the `journal-header` block renders
  as a raw `<pre>`, the markdown processor is stale —
  `obsidian vault=demo-vault plugin:reload id=journal-folder` fixes it.
  `app:reload` leaves the processor unregistered.
- **Target the leaf by path.** After `open`, find the markdown leaf whose
  `view.file.path` matches and `setActiveLeaf` it, so
  `.workspace-leaf.mod-active .markdown-reading-view` resolves to the right
  pane. Obsidian keeps a hidden live-preview copy of the header in the DOM at
  (0,0); scope chip-row measurements to the active reading view (`union`, not
  `bodyUnion`) or it blows up the crop.
- **Calendar visibility is a session-sticky store** with no public API.
  `ensureCalendar(true|false)` toggles it via the More popover and is
  idempotent; scenarios are ordered hidden-first to minimise toggling. After
  toggling it on you may need to re-open the note to force the cached reading
  view to re-render.
- **Custom panels survive a screenshot; native menus do not.** The More… panel,
  task scope panel, and modals (migration picker, settings) are plain portaled
  DOM and stay open across the `eval`/`dev:screenshot` calls. A native Obsidian
  `Menu` (`.menu`, e.g. the sidebar folder dropdown) dismisses on the window
  focus change `dev:screenshot` causes — so `sidebar-folder-picker` is **not**
  auto-regenerated; recapture it by hand if needed.
- **Recreate the sidebar leaf per scenario.** The sidebar's More…/Scope panels
  keep their open-state between scenarios; `detachLeavesOfType` + a fresh
  `setViewState` resets it. The harness also normalises the right-split width to
  ~290px so a dragged-wide sidebar doesn't make the crop look unrealistic.
- **Mobile shot:** `obsidian vault=demo-vault dev:mobile` toggles emulation
  (adds `.is-mobile`), then resize the window to a phone size via
  `eval "require('electron').remote.getCurrentWindow().setSize(414,896)"`.
  Re-open the note afterwards (emulation resets the active leaf) and toggle
  `dev:mobile` again to return to desktop.
