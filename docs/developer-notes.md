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

The screenshots in the project README are captured from a real Obsidian session
against the demo vault at `docs/demo-vault/`. The vault has the plugin
pre-installed, both Atlas and Personal journal folders set up, signifiers and a
bullet-journal task flow configured, and dates fixed around 2026-05-04 so the
demo world stays stable.

Capture is fully scripted through the **Obsidian CLI** (`obsidian <command>`,
needs Obsidian ≥ 1.12.7 with the CLI enabled) — `eval` to set up state and
measure, `dev:screenshot` to grab the window, `sips` to crop. The harness and
its sharp edges live in [`scripts/screenshots/`](../scripts/screenshots/README.md).

```bash
npm run build && npm run push           # sync the current build into the demo vault
# open the demo vault in Obsidian (light mode), then:
node scripts/screenshots/regenerate.mjs            # every shot
node scripts/screenshots/regenerate.mjs header     # just the headers
node scripts/screenshots/regenerate.mjs --list     # list scenario names
```

`regenerate.mjs` is the canonical record of how each PNG is composed (which
note, view mode, UI state, crop region). Edit it to add or retune a shot.

> The previous AppleScript + Swift-`CGEvent` + `screencapture` harness is gone:
> the CLI's `eval` dispatches real DOM events that fire Svelte handlers, so
> there's no need for hardware clicks, AX queries, or hand-tuned window
> coordinates. The one thing the CLI *can't* drive is a native Obsidian `Menu`
> (it dismisses on the focus change `dev:screenshot` causes) — but the plugin
> no longer uses one: the folder picker is now a `<body>`-portaled panel like
> the More… menu, so every shot (including `sidebar-folder-picker`) is
> reproducible with the commands above. See the harness README for the full
> list of gotchas (`plugin:reload` vs `app:reload`, the session-sticky calendar
> store, the hidden live-preview header copy, mobile emulation, …).
