/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { Editor } from 'obsidian'
import type { EditorView } from '@codemirror/view'

// Obsidian's `Editor` is backed by a CodeMirror 6 `EditorView`, exposed as
// `editor.cm` (not part of the public typings). We reach for it to fire
// Obsidian's own Enter handler rather than re-implementing list continuation.
type EditorWithCm = Editor & { cm?: EditorView }

/**
 * Start a fresh line below the cursor's current line, exactly as if the caret
 * had been at the **end** of that line and the user pressed Enter — so list,
 * checkbox, and blockquote continuation (and empty-item exit) behave natively.
 *
 * We deliberately do **not** reimplement Obsidian's continuation rules: we move
 * the caret to end-of-line and dispatch a real Enter keydown into CodeMirror so
 * Obsidian's own keymap handles it. When the CodeMirror view isn't reachable we
 * fall back to a plain newline (no continuation).
 */
export function startNewLineBelow(editor: Editor): void {
  const cursor = editor.getCursor()
  const lineText = editor.getLine(cursor.line)

  // Jump to the end of the whole line first, so the break lands below it
  // regardless of where the caret actually sat.
  editor.setCursor({ line: cursor.line, ch: lineText.length })

  const view = (editor as EditorWithCm).cm
  if (view && dispatchEnter(view)) return

  // Fallback: a plain line break with no list continuation.
  editor.replaceSelection('\n')
}

/**
 * Fire a native Enter keydown into the CodeMirror content element so Obsidian's
 * registered keymap runs its list-aware newline handler. Returns false when the
 * content element isn't available so the caller can fall back.
 */
function dispatchEnter(view: EditorView): boolean {
  const content = view.contentDOM
  if (!content) return false
  // Construct the event from the editor's own window so it works in popout
  // leaves too. CodeMirror's keymap matches on `event.key` / `event.code`.
  const win = (content.ownerDocument.defaultView ?? activeWindow) as Window & {
    KeyboardEvent: typeof KeyboardEvent
  }
  content.dispatchEvent(
    new win.KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  )
  return true
}
