import { describe, expect, it } from 'vitest'
import { resolveTaskModel } from '../../../../src/features/journal-tasks/task-models/resolve-model'

describe('resolveTaskModel', () => {
  it('returns the simple model by default', () => {
    expect(resolveTaskModel({ taskModel: 'simple' }).id).toBe('simple')
  })

  it('returns the bullet-journal model when configured', () => {
    expect(resolveTaskModel({ taskModel: 'bullet-journal' }).id).toBe(
      'bullet-journal'
    )
  })

  it('falls back to simple for unknown values', () => {
    expect(resolveTaskModel({ taskModel: 'tasks-plugin' }).id).toBe('simple')
  })
})
