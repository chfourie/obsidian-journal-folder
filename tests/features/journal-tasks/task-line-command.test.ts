import { describe, expect, it } from 'vitest'
import {
  computeTaskLineEdit,
  lineToTaskMarkdown,
} from '../../../src/features/journal-tasks/task-line-command'
import {
  bulletJournalTaskModel,
  simpleTaskModel,
} from '../../../src/features/journal-tasks/task-models'

describe('lineToTaskMarkdown', () => {
  it('prefixes a plain line with a bullet and status token', () => {
    expect(lineToTaskMarkdown('buy milk', '[ ]')).toBe('- [ ] buy milk')
  })

  it('reuses an existing bullet and indentation', () => {
    expect(lineToTaskMarkdown('  * read book', '[ ]')).toBe('  * [ ] read book')
  })

  it('preserves indentation on a plain line', () => {
    expect(lineToTaskMarkdown('    note', '[ ]')).toBe('    - [ ] note')
  })

  it('handles an empty bullet', () => {
    expect(lineToTaskMarkdown('- ', '[ ]')).toBe('- [ ] ')
  })

  it('does not duplicate a bare bullet with no trailing space', () => {
    expect(lineToTaskMarkdown('-', '[ ]')).toBe('- [ ] ')
    expect(lineToTaskMarkdown('*', '[ ]')).toBe('* [ ] ')
    expect(lineToTaskMarkdown('+', '[ ]')).toBe('+ [ ] ')
  })

  it('reuses a bare indented bullet rather than adding a second one', () => {
    expect(lineToTaskMarkdown('  -', '[ ]')).toBe('  - [ ] ')
  })

  it('treats a hyphen with no following space as literal text, not a bullet', () => {
    // `-no space` is a paragraph in markdown, so the hyphen is part of the
    // text — a fresh bullet is added and the literal hyphen kept.
    expect(lineToTaskMarkdown('-no space', '[ ]')).toBe('- [ ] -no space')
  })
})

describe('computeTaskLineEdit', () => {
  it('converts a non-task line to a task at the first status', () => {
    expect(computeTaskLineEdit('plan the day', simpleTaskModel)).toBe(
      '- [ ] plan the day'
    )
  })

  it('advances an existing task to the next status', () => {
    expect(computeTaskLineEdit('- [ ] one', simpleTaskModel)).toBe('- [x] one')
  })

  it('wraps the cycle back to the first status', () => {
    expect(computeTaskLineEdit('- [x] one', simpleTaskModel)).toBe('- [ ] one')
  })

  it('walks the bullet-journal primary cycle in order', () => {
    // Created at the first status, then following each configured
    // `next` link: open → in-progress → done → open.
    let line = computeTaskLineEdit('a task', bulletJournalTaskModel) as string
    const tokens: string[] = []
    for (let i = 0; i < 4; i++) {
      tokens.push(/\[(.)\]/.exec(line)![1])
      line = computeTaskLineEdit(line, bulletJournalTaskModel) as string
    }
    expect(tokens).toEqual([' ', '/', 'x', ' '])
  })

  it('preserves indentation, bullet, and trailing links when cycling', () => {
    expect(
      computeTaskLineEdit('    * [ ] task with [[link]]', simpleTaskModel)
    ).toBe('    * [x] task with [[link]]')
  })
})
