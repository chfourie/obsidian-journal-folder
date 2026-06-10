import { describe, expect, it } from 'vitest'
import { findDocumentTaskLines } from '../../../src/features/journal-tasks/document-task-line-map'
import { simpleTaskModel } from '../../../src/features/journal-tasks/task-models'
import { bulletJournalTaskModel } from '../../../src/features/journal-tasks/task-models'

describe('findDocumentTaskLines', () => {
  it('returns absolute line indices for task lines in the section', () => {
    const text = [
      '# Heading',
      'paragraph',
      '- [ ] one',
      'mid',
      '- [x] two',
      '## Other section',
      '- [ ] off-section',
    ].join('\n')
    expect(findDocumentTaskLines(text.split('\n'), 0, 4, simpleTaskModel)).toEqual([
      { line: 2, status: 'open' },
      { line: 4, status: 'done' },
    ])
  })

  it('ignores tasks the active model does not recognise', () => {
    const text = ['- [ ] one', '- [/] mid', '- [x] done'].join('\n')
    expect(
      findDocumentTaskLines(text.split('\n'), 0, 2, simpleTaskModel).map((t) => t.line)
    ).toEqual([0, 2])
  })

  it('recognises bullet-journal statuses when that model is active', () => {
    const text = ['- [/] mid', '- [>] migrated'].join('\n')
    expect(
      findDocumentTaskLines(text.split('\n'), 0, 1, bulletJournalTaskModel)
    ).toEqual([
      { line: 0, status: 'in-progress' },
      { line: 1, status: 'migrated' },
    ])
  })

  it('clamps lineEnd to the available content', () => {
    const text = ['- [ ] one'].join('\n')
    expect(findDocumentTaskLines(text.split('\n'), 0, 99, simpleTaskModel)).toEqual([
      { line: 0, status: 'open' },
    ])
  })

  it('skips task-like lines inside a fenced code block', () => {
    const text = [
      '- [ ] one',
      '```',
      '- [ ] fake',
      '```',
      '- [x] two',
    ].join('\n')
    expect(findDocumentTaskLines(text.split('\n'), 0, 4, simpleTaskModel)).toEqual([
      { line: 0, status: 'open' },
      { line: 4, status: 'done' },
    ])
  })

  it('keeps absolute line indices aligned for tasks after a fence', () => {
    // The zip contract: the rendered DOM has no task item for fenced
    // lines, so the parsed list must skip them too — the task after the
    // fence is the SECOND parsed entry, matching the second rendered item.
    const text = [
      '- [ ] real one',
      '  ```',
      '  - [ ] fake',
      '  ```',
      '- [ ] real two',
    ].join('\n')
    const result = findDocumentTaskLines(text.split('\n'), 0, 4, simpleTaskModel)
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({ line: 4, status: 'open' })
  })

  it('suppresses a section that sits inside an unclosed earlier fence', () => {
    // Fence state is tracked from line 0, so a fence opened before
    // `lineStart` suppresses the section's lines — matching the renderer,
    // which shows that content as code, not as task items.
    const text = ['```', '- [ ] fake', '- [ ] fake 2'].join('\n')
    expect(findDocumentTaskLines(text.split('\n'), 1, 2, simpleTaskModel)).toEqual([])
  })

  it('treats a fence closed before lineStart as inactive', () => {
    const text = ['```', 'code', '```', '- [ ] real'].join('\n')
    expect(findDocumentTaskLines(text.split('\n'), 3, 3, simpleTaskModel)).toEqual([
      { line: 3, status: 'open' },
    ])
  })
})
