# Screenshot harness

Drives Obsidian against the demo vault at `docs/demo-vault/` and re-captures
every PNG under `docs/screenshots/`. Lives in-repo so the next round of
regeneration starts from a working baseline (not a fresh rebuild).

## Layout

```
scripts/screenshots/
  click.swift   # CGEvent mouse click/move helper (compiled to bin/click)
  bin/click     # compiled binary (run via the Bash tool / AppleScript)
  lib.sh        # bash helpers (window positioning, AX queries, capture)
  README.md     # this file
```

## Why a Swift CGEvent helper

AppleScript's `click` and the Accessibility-API `AXPress` action **don't fire
Svelte click handlers** — Obsidian's sidebar More... trigger and the journal
header's More... chip are both `<span role="button">` with `onclick`
listeners, and AppleScript doesn't dispatch a real DOM event the way a
hardware click does. The Swift helper posts a real `CGEvent` mouse event
through `cghidEventTap`, which Svelte sees as identical to a user click.

Build the binary:

```bash
cd scripts/screenshots
swiftc click.swift -o bin/click
```

Usage:

```bash
bin/click click <x> <y>   # left-click at logical screen coords
bin/click move  <x> <y>   # park cursor without clicking
```

## Why precise coords instead of AX anchors

`System Events` against Obsidian's pane returns no usable AXLink children for
the journal header chip row — `entire contents` returns empty and recursive
`UI elements of` calls hang or crash. So coords are computed off a
deterministic window position (`{0, 30}` size `{1700, 1700}` for headers,
`{3200, 1700}` when capturing the sidebar More... menu so it has room to open
to the right without spilling into another window).

## Driving Obsidian

The demo vault is registered with Obsidian as `vault=demo-vault`. Open
specific notes via the URL scheme:

```bash
open "obsidian://open?vault=demo-vault&file=Project%20%E2%80%94%20Atlas%2F2026-05-04"
```

Reading mode (Cmd+E) is required so the leading `%% EDITING %%` comment
doesn't render literally. Zoom in (Cmd+= a few times) to get content sized
similar to the README's existing screenshots.

## Coordinates worth remembering (window {0,30} size {1700,1700})

These are the values that consistently work after the window is positioned and
zoom is set with ~4 Cmd+= presses. They drift if you change zoom, so re-probe
with `screencapture -R x,y,w,h /tmp/probe.png` and `Read /tmp/probe.png` if
nothing lines up.

| Element | Click coords | Notes |
| --- | --- | --- |
| In-note More... chip | `(980, 335)` | Toggles popover open/closed. |
| Show/Hide calendar (in popover) | `(1470, 395)` | Portaled to `<body>`, not in AX tree. |
| Sidebar More... link | `(3140, 130)` | Requires window resized to `{3200, 1700}`. |
| Sidebar folder picker | `(3140, 175)` | Opens folder Menu. |

## Capture geometries (logical points, screencapture -R format)

| Scenario | `-R` arg |
| --- | --- |
| `header-*` (with folder title) | `800,210,500,150` |
| `more-popover-daily` | `560,305,1000,200` |
| `more-popover-weekly` | `560,305,1000,300` |
| `more-popover-monthly` (calendar visible) | `560,300,1000,260` |
| `calendar-3-months` / `calendar-from-monthly` | `540,290,1020,400` |
| `sidebar-dynamic` (after window→{3200,1700}) | `2700,80,500,470` |
| `sidebar-more-menu` (after window→{3200,1700}) | `2700,80,500,400` |
| `sidebar-folder-picker` (after window→{3200,1700}) | `2700,80,500,400` |

## Regenerating a single screenshot — example

```bash
# 1. Build & sync plugin into demo vault
npm run build
cp main.js styles.css manifest.json docs/demo-vault/.obsidian/plugins/journal-folder/

# 2. Open vault, position window
open "obsidian://open?vault=demo-vault&file=Project%20%E2%80%94%20Atlas%2F2026-05-04"
osascript -e 'tell application "System Events" to tell process "Obsidian" \
  to tell (first window whose name contains "demo-vault") \
  to set {position, size} to {{0, 30}, {1700, 1700}}'

# 3. Make sure note is in Reading mode (Cmd+E)
osascript -e 'tell application "System Events" to keystroke "e" using {command down}'

# 4. Park the cursor away from the chip row before capturing
scripts/screenshots/bin/click move 30 1500

# 5. Capture
screencapture -R 800,210,500,150 -t png -x docs/screenshots/header-daily.png
```

## Captures that still need a manual round

| File | Why it wasn't auto-regenerated |
| --- | --- |
| `calendar-mobile.png` | Requires `app.emulateMobile(true)` in DevTools console; mobile re-mounts the workspace and resets the active leaf. |
| `header-quarterly.png`, `more-popover-yearly-quarters.png`, `calendar-with-quarters.png` | Toggling `quartersEnabled` in `data.json` requires an Obsidian reload to take effect on the rendered code-block. |
| `folder-config-modal.png`, `init-journal-folder-modal.png` | Modal trigger paths are deeper than the existing harness — open via the sidebar's More... menu. |

## Sharp edges

- **Calendar visibility is in-memory.** Once toggled in the running session,
  the data.json `default-calendar-visible-*` is ignored. To reset, restart
  Obsidian or toggle through the More popover.
- **`screencapture` then mouse move closes Obsidian popovers.** Some
  popovers/menus close on the next mouse-move event after a click. If you
  need a wide debug capture *and* the same popover state, take both captures
  back-to-back without parking the cursor in between, or take one wide
  capture and crop with `sips`.
- **Notification toasts.** After `obsidian://open` a toast banner reads
  "Opened file ..." for ~3 seconds at the top-right. Sleep at least 4
  seconds before capturing the header.
- **Other windows beyond the right edge.** When the sidebar More... menu
  opens to the right, it may spill onto an adjacent window. The harness
  works around this by widening the Obsidian window to `{3200, 1700}` so the
  menu lands fully within Obsidian.
