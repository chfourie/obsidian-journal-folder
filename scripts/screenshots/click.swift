// Drive a synthetic mouse click via CGEvent. AppleScript's `click` / AXPress
// does NOT fire Svelte click handlers (e.g. the sidebar's <span role="button">
// More... trigger), so we issue a real CGEvent click instead.
//
// Usage:
//   click <x> <y>            # left-click at logical screen coords
//   move  <x> <y>            # park the cursor without clicking
//
// Coordinates are macOS logical points (origin top-left of primary display).

import Foundation
import CoreGraphics

func usage() -> Never {
  FileHandle.standardError.write("usage: click|move <x> <y>\n".data(using: .utf8)!)
  exit(64)
}

let args = CommandLine.arguments
guard args.count == 4, let x = Double(args[2]), let y = Double(args[3]) else { usage() }
let action = args[1]
let pt = CGPoint(x: x, y: y)
let src = CGEventSource(stateID: .hidSystemState)

func post(_ type: CGEventType) {
  if let ev = CGEvent(mouseEventSource: src, mouseType: type, mouseCursorPosition: pt, mouseButton: .left) {
    ev.post(tap: .cghidEventTap)
  }
}

switch action {
case "move":
  post(.mouseMoved)
case "click":
  post(.mouseMoved)
  // Tiny settle so the OS sees the move before the down.
  usleep(20_000)
  post(.leftMouseDown)
  usleep(30_000)
  post(.leftMouseUp)
default:
  usage()
}
