import { describe, expect, it } from 'vitest'
import { findDocumentTaskLines } from '../../../src/features/journal-tasks/document-task-line-map'
import { simpleTaskModel } from '../../../src/features/journal-tasks/task-models/simple-model'
import { bulletJournalTaskModel } from '../../../src/features/journal-tasks/task-models/bullet-journal-model'

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
    expect(findDocumentTaskLines(text, 0, 4, simpleTaskModel)).toEqual([
      { line: 2, status: 'open' },
      { line: 4, status: 'done' },
    ])
  })

  it('ignores tasks the active model does not recognise', () => {
    const text = ['- [ ] one', '- [/] mid', '- [x] done'].join('\n')
    expect(
      findDocumentTaskLines(text, 0, 2, simpleTaskModel).map((t) => t.line)
    ).toEqual([0, 2])
  })

  it('recognises bullet-journal statuses when that model is active', () => {
    const text = ['- [/] mid', '- [>] migrated'].join('\n')
    expect(
      findDocumentTaskLines(text, 0, 1, bulletJournalTaskModel)
    ).toEqual([
      { line: 0, status: 'in-progress' },
      { line: 1, status: 'migrated' },
    ])
  })

  it('clamps lineEnd to the available content', () => {
    const text = ['- [ ] one'].join('\n')
    expect(findDocumentTaskLines(text, 0, 99, simpleTaskModel)).toEqual([
      { line: 0, status: 'open' },
    ])
  })
})
