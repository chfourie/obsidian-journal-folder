import { describe, expect, it } from 'vitest'
import { availableMigrationActions } from '../../../src/features/journal-tasks/task-migration'

describe('availableMigrationActions', () => {
  it('always offers "to this note"', () => {
    expect(
      availableMigrationActions({ hasLineTask: false, activeOnPageCount: 0 })
    ).toEqual(['to'])
  })

  it('offers the cursor-line option only on an active task line', () => {
    expect(
      availableMigrationActions({ hasLineTask: true, activeOnPageCount: 0 })
    ).toEqual(['line', 'to'])
  })

  it('offers "from this note" only when the page has active tasks', () => {
    expect(
      availableMigrationActions({ hasLineTask: false, activeOnPageCount: 3 })
    ).toEqual(['from', 'to'])
  })

  it('offers all three in line → from → to order', () => {
    expect(
      availableMigrationActions({ hasLineTask: true, activeOnPageCount: 2 })
    ).toEqual(['line', 'from', 'to'])
  })
})
