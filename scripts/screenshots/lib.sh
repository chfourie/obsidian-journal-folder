#!/usr/bin/env bash
# Shared helpers for the screenshot harness.
#
# Convention: all coordinates are macOS logical points (origin top-left of the
# main display). screencapture -R takes the same units. Capture geometries are
# expressed as "X,Y,W,H".
#
# Anchor strategy: AX queries return a stable (x, y) for the in-note "Today"
# AXLink on every header tier. We anchor click coordinates off it because the
# rest of the chip row shifts depending on which links render. The "More..."
# chip is a <span role="button">, NOT an AXLink, so it isn't queryable; we
# offset from Today and click via CGEvent (Swift helper) because AXPress on a
# Svelte handler is a no-op.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VAULT="$ROOT/docs/demo-vault"
SHOTS="$ROOT/docs/screenshots"
CLICK="$ROOT/scripts/screenshots/bin/click"

# --- Window geometry ---
# Position Obsidian deterministically. Pane center then sits at a known x,
# so capture rectangles can be hard-coded per scenario.
WIN_X=0
WIN_Y=30
WIN_W=1600
WIN_H=1080

position_window() {
  osascript <<APPLESCRIPT
tell application "System Events"
  tell process "Obsidian"
    set frontmost to true
    if (count of windows) > 0 then
      tell window 1
        set position to {$WIN_X, $WIN_Y}
        set size to {$WIN_W, $WIN_H}
      end tell
    end if
  end tell
end tell
APPLESCRIPT
}

# Open a note in the demo vault by relative path (no leading slash, no .md).
# Example: open_note "Project — Atlas/2026-05-04"
open_note() {
  local note="$1"
  local enc
  enc=$(python3 -c 'import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))' "$note")
  local vault_enc
  vault_enc=$(python3 -c 'import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))' "$(basename "$VAULT")")
  open "obsidian://open?vault=${vault_enc}&file=${enc}"
  sleep 0.6
}

# Open the demo vault (idempotent — if Obsidian is already running on it,
# this just brings it forward).
open_vault() {
  open -a Obsidian "$VAULT"
  sleep 1.5
  position_window
  sleep 0.3
}

# Find the "Today" AXLink position (logical points, top-left of the link).
# Echoes "x y w h" or empty string if not found.
find_today() {
  osascript <<'APPLESCRIPT' 2>/dev/null || true
on findIn(elem)
  try
    if (role of elem) is "AXLink" and (description of elem) is "Today" then
      set p to position of elem
      set s to size of elem
      return ((item 1 of p) as text) & " " & ((item 2 of p) as text) & " " & ((item 1 of s) as text) & " " & ((item 2 of s) as text)
    end if
  end try
  try
    repeat with child in (UI elements of elem)
      set r to findIn(child)
      if r is not "" then return r
    end repeat
  end try
  return ""
end findIn

tell application "System Events"
  tell process "Obsidian"
    repeat with w in windows
      set r to findIn(w)
      if r is not "" then return r
    end repeat
  end tell
end tell
return ""
APPLESCRIPT
}

# Click a screen coordinate via CGEvent (real click, fires Svelte handlers).
do_click() { "$CLICK" click "$1" "$2"; sleep 0.25; }
do_move()  { "$CLICK" move  "$1" "$2"; sleep 0.1;  }

# Park the cursor in a neutral spot so :hover state on the More chip etc.
# doesn't bleed into the next capture.
park_cursor() { do_move 30 900; }

# Capture a region to docs/screenshots/<name>.png.
# Geometry is "X,Y,W,H" in logical points. screencapture handles Retina x2.
capture() {
  local name="$1" geom="$2"
  IFS=',' read -r x y w h <<<"$geom"
  screencapture -R "${x},${y},${w},${h}" -t png -x "$SHOTS/${name}.png"
  echo "captured $name"
}

# Wait for the More popover to appear after a click. The popover is portaled
# to <body> outside the editor pane.
sleep_popover() { sleep 0.35; }

# Toggle the journal-header More popover. Anchored on Today's chip — More...
# sits ~39pt to the left of Today's left edge.
toggle_more() {
  local today
  today=$(find_today)
  [[ -z "$today" ]] && { echo "Today chip not found" >&2; return 1; }
  read -r tx ty tw th <<<"$today"
  local cx=$(python3 -c "print(int($tx) - 24)")
  local cy=$(python3 -c "print(int($ty) + int($th)/2)")
  do_click "$cx" "$cy"
  sleep_popover
}

# Toggle the calendar from inside an open More popover. The Show/Hide
# calendar link is portaled to <body>; on the standard 760pt pane it sits
# around (Today.x + 280, Today.y + 48). Tunable per layout.
toggle_calendar_in_popover() {
  local today=$(find_today)
  [[ -z "$today" ]] && return 1
  read -r tx ty tw th <<<"$today"
  local cx=$(python3 -c "print(int($tx) + 280)")
  local cy=$(python3 -c "print(int($ty) + 48)")
  do_click "$cx" "$cy"
  sleep_popover
}
