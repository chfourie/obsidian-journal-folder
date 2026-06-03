import { describe, expect, it } from 'vitest'
import { bulletJournalTaskModel } from '../../../../src/features/journal-tasks/task-models'

describe('bulletJournalTaskModel', () => {
  describe('parseLine', () => {
    it.each([
      [' ', 'open'],
      ['/', 'in-progress'],
      ['x', 'done'],
      ['X', 'done'],
      ['>', 'migrated'],
      ['-', 'cancelled'],
      ['d', 'delegated'],
    ])('parses [%s] as %s', (char, status) => {
      expect(bulletJournalTaskModel.parseLine(`- [${char}] task`)).toEqual({
        status,
        text: 'task',
      })
    })

    it('returns null for unknown chars', () => {
      expect(bulletJournalTaskModel.parseLine('- [?] task')).toBeNull()
    })

    it('returns null for non-task lines', () => {
      expect(bulletJournalTaskModel.parseLine('plain text')).toBeNull()
    })
  })

  describe('serializeStatus', () => {
    it('round-trips every status', () => {
      for (const status of bulletJournalTaskModel.statuses) {
        const token = bulletJournalTaskModel.serializeStatus(status.id)
        expect(token).toBe(`[${status.char}]`)
      }
    })
  })

  describe('isDone', () => {
    it('treats done, migrated, cancelled, delegated as done', () => {
      expect(bulletJournalTaskModel.isDone('done')).toBe(true)
      expect(bulletJournalTaskModel.isDone('migrated')).toBe(true)
      expect(bulletJournalTaskModel.isDone('cancelled')).toBe(true)
      expect(bulletJournalTaskModel.isDone('delegated')).toBe(true)
    })

    it('treats open and in-progress as not done', () => {
      expect(bulletJournalTaskModel.isDone('open')).toBe(false)
      expect(bulletJournalTaskModel.isDone('in-progress')).toBe(false)
    })
  })

  describe('nextStatus', () => {
    it('cycles open → in-progress → done → open', () => {
      expect(bulletJournalTaskModel.nextStatus('open')).toBe('in-progress')
      expect(bulletJournalTaskModel.nextStatus('in-progress')).toBe('done')
      expect(bulletJournalTaskModel.nextStatus('done')).toBe('open')
    })

    it('routes migrated, cancelled, delegated back to open', () => {
      expect(bulletJournalTaskModel.nextStatus('migrated')).toBe('open')
      expect(bulletJournalTaskModel.nextStatus('cancelled')).toBe('open')
      expect(bulletJournalTaskModel.nextStatus('delegated')).toBe('open')
    })
  })

  describe('statuses', () => {
    it('lists all six in display order', () => {
      expect(bulletJournalTaskModel.statuses.map((s) => s.id)).toEqual([
        'open',
        'in-progress',
        'done',
        'migrated',
        'cancelled',
        'delegated',
      ])
    })
  })
})
