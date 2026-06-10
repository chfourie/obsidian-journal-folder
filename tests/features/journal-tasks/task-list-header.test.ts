import { describe, expect, it } from 'vitest'
import { taskListHeaderLabel } from '../../../src/features/journal-tasks/task-list-header'

describe('taskListHeaderLabel', () => {
  it('shows the pre-cap total when completed tasks are shown', () => {
    expect(
      taskListHeaderLabel({
        showCompleted: true,
        totalBeforeCap: 10,
        hiddenCompletedCount: 0,
      })
    ).toBe('TASKS (10)')
  })

  it('shows the pre-cap visible total plus the hidden count when filtering', () => {
    expect(
      taskListHeaderLabel({
        showCompleted: false,
        totalBeforeCap: 10,
        hiddenCompletedCount: 3,
      })
    ).toBe('TASKS (10 · 3 ✓ hidden)')
  })

  it('keeps the hidden suffix at zero so the active filter stays visible', () => {
    expect(
      taskListHeaderLabel({
        showCompleted: false,
        totalBeforeCap: 5,
        hiddenCompletedCount: 0,
      })
    ).toBe('TASKS (5 · 0 ✓ hidden)')
  })

  it('counts the same population as the truncation footer when the cap hits', () => {
    // The cap trims the rendered list to e.g. 3 items, but the header
    // states the footer's "of N" — never the capped list length.
    const label = taskListHeaderLabel({
      showCompleted: false,
      totalBeforeCap: 12,
      hiddenCompletedCount: 4,
    })
    expect(label).toContain('(12 ·')
  })

  it('uses a custom caption verbatim and falls back on a blank one', () => {
    expect(
      taskListHeaderLabel({
        caption: 'My tasks',
        showCompleted: true,
        totalBeforeCap: 1,
        hiddenCompletedCount: 0,
      })
    ).toBe('My tasks (1)')
    expect(
      taskListHeaderLabel({
        caption: '   ',
        showCompleted: true,
        totalBeforeCap: 1,
        hiddenCompletedCount: 0,
      })
    ).toBe('TASKS (1)')
  })
})
