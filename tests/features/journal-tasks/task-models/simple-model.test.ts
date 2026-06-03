import { describe, expect, it } from 'vitest'
import { simpleTaskModel } from '../../../../src/features/journal-tasks/task-models/simple-model'

describe('simpleTaskModel', () => {
  describe('parseLine', () => {
    it('parses an open task', () => {
      expect(simpleTaskModel.parseLine('- [ ] Buy milk')).toEqual({
        status: 'open',
        text: 'Buy milk',
      })
    })

    it('parses a done task with lowercase x', () => {
      expect(simpleTaskModel.parseLine('- [x] Buy milk')).toEqual({
        status: 'done',
        text: 'Buy milk',
      })
    })

    it('parses a done task with uppercase X', () => {
      expect(simpleTaskModel.parseLine('- [X] Buy milk')).toEqual({
        status: 'done',
        text: 'Buy milk',
      })
    })

    it('accepts `*` and `+` bullets', () => {
      expect(simpleTaskModel.parseLine('* [ ] one')).toEqual({
        status: 'open',
        text: 'one',
      })
      expect(simpleTaskModel.parseLine('+ [x] two')).toEqual({
        status: 'done',
        text: 'two',
      })
    })

    it('accepts indentation', () => {
      expect(simpleTaskModel.parseLine('    - [ ] nested')).toEqual({
        status: 'open',
        text: 'nested',
      })
    })

    it('returns null for a non-task line', () => {
      expect(simpleTaskModel.parseLine('# heading')).toBeNull()
      expect(simpleTaskModel.parseLine('- bullet without checkbox')).toBeNull()
      expect(simpleTaskModel.parseLine('')).toBeNull()
    })

    it('returns null for an unknown status character', () => {
      // The simple model only knows ' ' and 'x'; '>' is bullet-journal only.
      expect(simpleTaskModel.parseLine('- [>] migrated')).toBeNull()
    })

    it('parses task text with no space after the checkbox', () => {
      expect(simpleTaskModel.parseLine('- [ ]No space')).toEqual({
        status: 'open',
        text: 'No space',
      })
    })
  })

  describe('serializeStatus', () => {
    it('returns the full bracketed token', () => {
      expect(simpleTaskModel.serializeStatus('open')).toBe('[ ]')
      expect(simpleTaskModel.serializeStatus('done')).toBe('[x]')
    })

    it('throws on unknown status', () => {
      expect(() => simpleTaskModel.serializeStatus('bogus')).toThrow()
    })
  })

  describe('isDone', () => {
    it('only treats `done` as done', () => {
      expect(simpleTaskModel.isDone('open')).toBe(false)
      expect(simpleTaskModel.isDone('done')).toBe(true)
    })
  })

  describe('nextStatus', () => {
    it('cycles open ↔ done', () => {
      expect(simpleTaskModel.nextStatus('open')).toBe('done')
      expect(simpleTaskModel.nextStatus('done')).toBe('open')
    })
  })
})
