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

3. For each scenario, navigate to the relevant note (e.g. `Project — Atlas/2026-05-04`), set the calendar/popover state you want, and capture the rendered area with `screencapture -R x,y,w,h`. Crop with `sips --cropOffset y x -c h w`. The mobile shot uses Obsidian's `app.emulateMobile(true)` toggled from DevTools.

The older Playwright-based mock harness at `docs/screenshot-harness/` is kept as a reference but no longer drives the README — its hand-rolled HTML had drifted from the real Svelte output (e.g. `<--` arrows instead of `«`).
