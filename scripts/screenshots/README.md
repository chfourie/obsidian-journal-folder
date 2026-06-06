# Screenshot harness (Obsidian CLI)

Regenerates every PNG under `docs/screenshots/` from **one idempotent command**,
with **zero manual vault prep**. It drives the running Obsidian instance against
the demo vault through the [Obsidian CLI](https://obsidian.md/help/cli) — no
AppleScript, no synthetic hardware clicks, no hand-tuned capture coordinates. The
CLI's `eval` dispatches real DOM events (which fire Svelte handlers),
`dev:screenshot` captures the window, and we crop to a measured bounding rect
with `sips`.

It **reuses the E2E suite's CLI/DOM plumbing** (`tests/e2e/lib/{cli,page}.mjs`,
selected via `JF_E2E_VAULT=demo-vault`) and the same preflight discipline
(visibility gate → build/deploy → reload → detach leaves → readiness probe), so a
run never silently produces blank/partial PNGs.

## Files

```
scripts/screenshots/
  run.mjs            # entry point: preflight + per-scene drive + crop + restore
  scenes.mjs         # the declarative manifest (one entry per PNG)
  lib/
    capture.mjs      # measure rect → full-window screenshot → sips crop; calendar/More helpers
    demo-vault.mjs   # deploy, reload, data.json backup/restore, settings fixtures,
                     #   temp files, mobile emulation, light-mode, sidebar recreate
  .captures/         # saved full-window frames + sidecar rects (gitignored)
  README.md          # this file
```

## Prerequisites

- **Obsidian ≥ 1.12.7**, running, with the CLI enabled
  (Settings → General → "Command line interface"). Check with `which obsidian`.
- The **demo vault** (`docs/demo-vault/`) open and registered as `vault=demo-vault`
  (one-time: File → Open folder as vault → accept the trust prompt), its window
  **visible** (not occluded / on another Space / minimized — a hidden window
  renders an empty reading view), in **light mode** (the run forces it anyway and
  restores your scheme afterward).
- Run **with the sandbox off** — the CLI uses a local IPC socket.
- `sips` (ships with macOS) for cropping.

> ⚠ **Confirm the vault.** The repo root sometimes gets opened as its own vault
> named `obsidian-journal-folder`; the bare CLI targets whatever is focused. The
> harness verifies `app.vault.getName() === 'demo-vault'` in preflight and aborts
> otherwise. See `docs/agent-notes.md`.

## Usage

```bash
npm run screenshots                  # build + deploy + regenerate every scene
npm run screenshots -- header        # only scenes whose name contains "header"
npm run screenshots -- --list        # list scene names (no Obsidian needed)
npm run screenshots -- --no-deploy   # use the build already in the demo vault
npm run screenshots -- --recrop      # re-cut crops from the last run's saved frames
```

After a run, `git status docs/screenshots` shows exactly which shots changed — a
quick visual review gate.

## How it works (two phases)

Capture is split so the slow/stateful part and the fiddly/pure part are
independent:

1. **Drive (stateful).** Preflight, then per scene: `resetUi` → apply the scene's
   settings fixture over the backed-up `data.json` → open the note / drive the UI
   via `data-jf-*` hooks → **measure the crop rect** → save the **full-window
   frame** + a **sidecar rect** under `.captures/`.
2. **Crop (pure).** `sips` the rect out of the saved frame into
   `docs/screenshots/<name>.png`.

Because the full frames + rects are saved, `--recrop` re-runs only phase 2 — so a
crop that's slightly off, or a changed `pad` in `scenes.mjs`, is re-cut instantly
**without re-driving Obsidian**. And when a crop looks wrong, open the saved frame
in `.captures/<name>.png` to see exactly what state was captured (this is how the
"More popover rendered at 0,0" and "sidebar menu fell back to a centered sheet"
bugs were spotted at a glance).

## Adding / editing a scene

Each scene in `scenes.mjs`:

```js
{ name, note?, mode='preview', settings?, tempFiles?, mobile?,
  setup?: async (ctx) => {}, rect, pad=14 }
```

- `settings` — a fixture shallow-merged over the demo `data.json` baseline (which
  is backed up and restored around the run), so a scene doesn't depend on the
  vault's saved settings.
- `setup(ctx)` — drive the scene with the reused page helpers + calendar/sidebar
  helpers on `ctx` (`click`, `openNote`, `openSettings`, `ensureCalendar`,
  `openMore`, `recreateSidebar`, `evalRaw`, `inPage`, `sleep`).
- `rect` — a JS expression measured in-page with `rectOf` / `union` / `bodyRect`
  / `bodyUnion` in scope (see `lib/capture.mjs`).

## Sharp edges (each cost real time)

- **Two header copies.** The active leaf keeps both a reading view and a hidden
  live-preview (source) header in the DOM; a bare `.mod-active [data-jf-more-button]`
  hits the **hidden** one (its options sit at 0,0) and its popover renders blank
  at the top-left. Scope interactive reading-view queries to `.markdown-reading-view`
  (the calendar/More helpers already do).
- **Portaled panels position via `requestAnimationFrame`**, which is throttled
  while Obsidian isn't the foreground app during CLI driving — so a freshly opened
  sidebar menu can stay at its default top-left (a wide "centered sheet"). Firing a
  window `resize` after opening runs the reposition synchronously (`openSidebarMenu`
  does this).
- **Native menus can't be captured** — a native Obsidian `Menu` (`.menu`) dismisses
  on the window-focus change `dev:screenshot` causes. The plugin's menus are all
  `<body>`-portaled custom panels (which survive), so every shot is reproducible.
- **Light mode, never `Cmd+=` zoom** — zoom narrows the pane and collapses the
  in-note calendar from 3 months to 1, misrepresenting the feature.
- **Calendar visibility is a session-sticky store** — `ensureCalendar(true|false)`
  toggles it via the More popover and is idempotent.
- **Sidebar panel open-state is sticky** — `recreateSidebar` detaches + recreates
  the leaf to reset the Svelte panel state, and normalizes the right-split width to
  ~290px so a dragged-wide sidebar doesn't make crops look unrealistic.
- **Mobile shot** — `dev:mobile on` adds `.is-mobile` and narrows the pane so the
  calendar drops to a single enlarged month; restored to desktop afterward.
- Screenshots are Retina (`devicePixelRatio` 2); rects are multiplied by the dpr
  before `sips`.
