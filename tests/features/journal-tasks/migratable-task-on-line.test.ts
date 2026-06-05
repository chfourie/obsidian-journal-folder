import { describe, expect, it } from 'vitest'
import { TFile } from '../../mocks/obsidian'
import { migratableTaskOnLine } from '../../../src/features/journal-tasks/task-migration'
import {
  bulletJournalTaskModel,
  simpleTaskModel,
} from '../../../src/features/journal-tasks/task-models'

function file(): TFile {
  const f = new TFile()
  f.basename = '2026-06-04'
  f.name = '2026-06-04.md'
  f.path = 'Journal/2026-06-04.md'
  return f
}

describe('migratableTaskOnLine', () => {
  it('returns a MigratableTask for an active task line', () => {
    const f = file()
    const task = migratableTaskOnLine(simpleTaskModel, f, 3, '- [ ] do thing')
    expect(task).toEqual({
      sourceFile: f,
      sourceLine: 3,
      rawText: '- [ ] do thing',
      status: 'open',
    })
  })

  it('returns null for a non-task line', () => {
    expect(
      migratableTaskOnLine(simpleTaskModel, file(), 0, 'just a paragraph')
    ).toBeNull()
  })

  it('returns null for a completed task (nothing to migrate)', () => {
    expect(
      migratableTaskOnLine(simpleTaskModel, file(), 0, '- [x] already done')
    ).toBeNull()
  })

  it('treats other inactive statuses as non-migratable', () => {
    // `[-]` (cancelled) is a done-equivalent status in the BuJo flow.
    expect(
      migratableTaskOnLine(bulletJournalTaskModel, file(), 0, '- [-] cancelled')
    ).toBeNull()
  })

  it('migrates an in-progress task in the BuJo flow', () => {
    const task = migratableTaskOnLine(
      bulletJournalTaskModel,
      file(),
      1,
      '- [/] in progress'
    )
    expect(task?.status).toBe('in-progress')
  })
})
