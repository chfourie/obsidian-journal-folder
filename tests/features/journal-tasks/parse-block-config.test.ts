import { describe, expect, it } from 'vitest'
import { parseJournalTasksBlock } from '../../../src/features/journal-tasks/parse-block-config'

describe('parseJournalTasksBlock', () => {
  it('returns an empty config for an empty body', () => {
    expect(parseJournalTasksBlock('')).toEqual({})
  })

  it('parses comma-separated folders', () => {
    expect(parseJournalTasksBlock('folders: a, b , c')).toEqual({
      folders: ['a', 'b', 'c'],
    })
  })

  it('maps unit aliases to JournalTimeUnit values', () => {
    expect(
      parseJournalTasksBlock('units: daily, weekly, monthly').units
    ).toEqual(['day', 'week', 'month'])
  })

  it('parses show-completed and max-items', () => {
    const config = parseJournalTasksBlock(
      ['show-completed: false', 'max-items: 30'].join('\n')
    )
    expect(config.showCompleted).toBe(false)
    expect(config.maxItems).toBe(30)
  })

  it('parses caption verbatim, preserving spaces and case', () => {
    expect(parseJournalTasksBlock('caption: This week').caption).toBe(
      'This week'
    )
  })

  it('ignores unknown keys', () => {
    expect(parseJournalTasksBlock('bogus: value')).toEqual({})
  })

  it('leaves show-completed unset for non-boolean values', () => {
    expect(
      parseJournalTasksBlock('show-completed: treu').showCompleted
    ).toBeUndefined()
    expect(
      parseJournalTasksBlock('show-completed: yes').showCompleted
    ).toBeUndefined()
  })

  it('parses show-completed: true case-insensitively', () => {
    expect(
      parseJournalTasksBlock('show-completed: TRUE').showCompleted
    ).toBe(true)
  })
})
