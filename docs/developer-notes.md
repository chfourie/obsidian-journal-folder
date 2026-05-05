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
