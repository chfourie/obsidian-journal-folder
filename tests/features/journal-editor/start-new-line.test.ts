import { describe, expect, it, vi } from 'vitest'
import type { Editor } from 'obsidian'
import { startNewLineBelow } from '../../../src/features/journal-editor/start-new-line'

type Cursor = { line: number; ch: number }

// A minimal stand-in for Obsidian's `Editor`, tracking the calls the command
// makes. `cm` is optional so we can exercise both the native-Enter path (a fake
// CodeMirror view) and the plain-newline fallback (no view).
function makeEditor(
  lines: string[],
  cursor: Cursor,
  cm?: { contentDOM: HTMLElement }
) {
  const setCursor = vi.fn((c: Cursor) => {
    cursor = c
  })
  const replaceSelection = vi.fn()
  const editor = {
    getCursor: () => cursor,
    getLine: (line: number) => lines[line],
    setCursor,
    replaceSelection,
    cm,
  } as unknown as Editor
  return { editor, setCursor, replaceSelection, getCursor: () => cursor }
}

describe('startNewLineBelow', () => {
  it('moves the caret to the end of the current line first', () => {
    const { editor, setCursor } = makeEditor(['  - a bullet'], {
      line: 0,
      ch: 4,
    })
    startNewLineBelow(editor)
    expect(setCursor).toHaveBeenCalledWith({ line: 0, ch: '  - a bullet'.length })
  })

  it('falls back to a plain newline when no CodeMirror view is available', () => {
    const { editor, replaceSelection } = makeEditor(['hello world'], {
      line: 0,
      ch: 2,
    })
    startNewLineBelow(editor)
    expect(replaceSelection).toHaveBeenCalledWith('\n')
  })

  it('dispatches a native Enter keydown into CodeMirror instead of a plain newline', () => {
    const contentDOM = activeDocument.createElement('div')
    const events: KeyboardEvent[] = []
    contentDOM.addEventListener('keydown', (e) => events.push(e))

    const { editor, replaceSelection, setCursor } = makeEditor(
      ['- [ ] task'],
      { line: 0, ch: 3 },
      { contentDOM }
    )
    startNewLineBelow(editor)

    // Caret moved to end of line, then a real Enter was emitted — and we did
    // NOT fall back to inserting a literal newline ourselves.
    expect(setCursor).toHaveBeenCalledWith({ line: 0, ch: '- [ ] task'.length })
    expect(replaceSelection).not.toHaveBeenCalled()
    expect(events).toHaveLength(1)
    expect(events[0].key).toBe('Enter')
    expect(events[0].bubbles).toBe(true)
  })
})
