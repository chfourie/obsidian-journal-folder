import { describe, expect, it } from 'vitest'
import { TFile } from '../../mocks/obsidian'
import type { JournalTask } from '../../../src/data-access'
import { sortTasks } from '../../../src/features/journal-tasks/task-sorting'

function task(overrides: Partial<JournalTask>): JournalTask {
  return {
    sourceFile: new TFile(),
    sourceLine: 0,
    rawText: '',
    displayText: '',
    status: 'open',
    noteUnit: 'day',
    noteRangeDays: 1,
    noteTitleShort: '',
    folderPath: '',
    ...overrides,
  }
}

describe('sortTasks', () => {
  it('orders by ascending noteRangeDays', () => {
    const monthly = task({ noteRangeDays: 30, displayText: 'monthly' })
    const daily = task({ noteRangeDays: 1, displayText: 'daily' })
    const weekly = task({ noteRangeDays: 7, displayText: 'weekly' })
    expect(sortTasks([monthly, daily, weekly]).map((t) => t.displayText)).toEqual(
      ['daily', 'weekly', 'monthly']
    )
  })

  it('tie-breaks by folderPath then sourceLine', () => {
    const a = task({ noteRangeDays: 1, folderPath: 'B', sourceLine: 0, displayText: 'a' })
    const b = task({ noteRangeDays: 1, folderPath: 'A', sourceLine: 5, displayText: 'b' })
    const c = task({ noteRangeDays: 1, folderPath: 'A', sourceLine: 2, displayText: 'c' })
    expect(sortTasks([a, b, c]).map((t) => t.displayText)).toEqual([
      'c',
      'b',
      'a',
    ])
  })

  it('does not mutate the input array', () => {
    const input = [task({ noteRangeDays: 7 }), task({ noteRangeDays: 1 })]
    const copy = [...input]
    sortTasks(input)
    expect(input).toEqual(copy)
  })
})
