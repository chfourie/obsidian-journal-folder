import { describe, expect, it } from 'vitest'
import type { JournalTask, TaskCategory } from '../../../src/data-access'
import { groupTasksByCategory } from '../../../src/features/journal-tasks/group-tasks-by-category'

const categories: TaskCategory[] = [
  { id: 'important', label: 'Important', tags: ['important'] },
  { id: 'work', label: 'Work', tags: ['work'] },
]

function task(id: string, categoryIds: string[]): JournalTask {
  return {
    sourceLine: 0,
    rawText: id,
    displayText: id,
    status: 'open',
    noteUnit: 'day',
    noteRangeDays: 1,
    noteTitleShort: id,
    noteTitle: id,
    folderPath: 'J',
    signifierIds: [],
    categoryIds,
    // sourceFile is unused by the grouping; supply a stub.
    sourceFile: { path: `J/${id}.md` },
  } as unknown as JournalTask
}

describe('groupTasksByCategory', () => {
  it('lists a multi-category task under every matching category', () => {
    const t = task('a', ['important', 'work'])
    const { categorySections } = groupTasksByCategory([t], categories, false)
    expect(categorySections.map((s) => s.category.id)).toEqual([
      'important',
      'work',
    ])
    expect(categorySections.every((s) => s.tasks.includes(t))).toBe(true)
  })

  it('omits empty categories and preserves config order', () => {
    const t = task('a', ['work'])
    const { categorySections } = groupTasksByCategory([t], categories, false)
    expect(categorySections.map((s) => s.category.id)).toEqual(['work'])
  })

  it('keeps a categorized task out of the note area when showUnderNote is off', () => {
    const cat = task('a', ['important'])
    const plain = task('b', [])
    const { noteTasks } = groupTasksByCategory([cat, plain], categories, false)
    expect(noteTasks).toEqual([plain])
  })

  it('also lists categorized tasks under their note when showUnderNote is on', () => {
    const cat = task('a', ['important'])
    const plain = task('b', [])
    const { noteTasks } = groupTasksByCategory([cat, plain], categories, true)
    expect(noteTasks).toEqual([cat, plain])
  })
})
