import { describe, expect, it } from 'vitest'
import { buildTaskModel } from '../../../../src/features/journal-tasks/task-models/build-task-model'
import type { TaskStatus } from '../../../../src/data-access/task-model.type'

const status = (overrides: Partial<TaskStatus>): TaskStatus => ({
  id: overrides.id ?? 'open',
  label: overrides.label ?? 'Open',
  char: overrides.char ?? ' ',
  isDone: overrides.isDone ?? false,
  next: overrides.next ?? 'open',
  shell: overrides.shell ?? { shape: 'none' },
  icon: overrides.icon ?? { source: { kind: 'none' } },
})

describe('buildTaskModel', () => {
  it('cycles through per-status `next` links', () => {
    const model = buildTaskModel([
      status({ id: 'open', char: ' ', next: 'in-progress' }),
      status({ id: 'in-progress', char: '/', next: 'done' }),
      status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
    ])
    expect(model.nextStatus('open')).toBe('in-progress')
    expect(model.nextStatus('in-progress')).toBe('done')
    expect(model.nextStatus('done')).toBe('open')
  })

  it('falls back to the first status when `next` points at a missing id', () => {
    const model = buildTaskModel([
      status({ id: 'open', char: ' ', next: 'in-progress' }),
      status({ id: 'done', char: 'x', isDone: true, next: 'ghost' }),
    ])
    expect(model.nextStatus('done')).toBe('open')
  })

  it('produces a model id that changes when char / isDone / next change', () => {
    const a = buildTaskModel([
      status({ id: 'open', char: ' ', next: 'done' }),
      status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
    ])
    const sameVisuals = buildTaskModel([
      status({
        id: 'open',
        char: ' ',
        next: 'done',
        shell: {
          shape: 'circle',
          background: { kind: 'token', var: '--color-blue' },
        },
      }),
      status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
    ])
    const differentChar = buildTaskModel([
      status({ id: 'open', char: '~', next: 'done' }),
      status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
    ])
    expect(a.id).toBe(sameVisuals.id)
    expect(a.id).not.toBe(differentChar.id)
  })

  describe('opensPickerOnClick', () => {
    it('is true for a status whose `next` points at itself', () => {
      const model = buildTaskModel([
        status({ id: 'open', char: ' ', next: 'in-progress' }),
        status({ id: 'in-progress', char: '/', next: 'in-progress' }),
        status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
      ])
      expect(model.opensPickerOnClick('in-progress')).toBe(true)
    })

    it('is false for a status that cycles to a different status', () => {
      const model = buildTaskModel([
        status({ id: 'open', char: ' ', next: 'done' }),
        status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
      ])
      expect(model.opensPickerOnClick('open')).toBe(false)
      expect(model.opensPickerOnClick('done')).toBe(false)
    })

    it('is false for an unknown status id', () => {
      const model = buildTaskModel([
        status({ id: 'open', char: ' ', next: 'done' }),
        status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
      ])
      expect(model.opensPickerOnClick('ghost')).toBe(false)
    })

    it('distinguishes a real self-link from the missing-id cycle fallback', () => {
      // A dangling `next` also makes `nextStatus` return the same status
      // as the first entry, but that is the fallback path — not a
      // configured self-link — and must NOT open the picker.
      const model = buildTaskModel([
        status({ id: 'open', char: ' ', next: 'ghost' }),
        status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
      ])
      expect(model.opensPickerOnClick('open')).toBe(false)
    })

    it('is true for every status when clickOpensPicker is on', () => {
      const statuses = [
        status({ id: 'open', char: ' ', next: 'done' }),
        status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
      ]
      const model = buildTaskModel(statuses, 'plugin', undefined, true)
      // Both a plain cycling status and the done status open the picker.
      expect(model.opensPickerOnClick('open')).toBe(true)
      expect(model.opensPickerOnClick('done')).toBe(true)
      // And nextStatus is still defined (cycling is the fallback if a
      // surface ever calls it directly).
      expect(model.nextStatus('open')).toBe('done')
    })

    it('clickOpensPicker even reports true for an unknown status id', () => {
      const model = buildTaskModel(
        [status({ id: 'open', char: ' ', next: 'done' })],
        'plugin',
        undefined,
        true
      )
      expect(model.opensPickerOnClick('ghost')).toBe(true)
    })
  })

  it('model id changes with the clickOpensPicker flag', () => {
    const statuses = [
      status({ id: 'open', char: ' ', next: 'done' }),
      status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
    ]
    const cycle = buildTaskModel(statuses, 'plugin', undefined, false)
    const pick = buildTaskModel(statuses, 'plugin', undefined, true)
    expect(cycle.id).not.toBe(pick.id)
  })

  it('first matching char wins on duplicates', () => {
    const model = buildTaskModel([
      status({ id: 'open', char: 'x', isDone: false, next: 'open' }),
      status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
    ])
    expect(model.parseLine('- [x] hi')?.status).toBe('open')
  })

  describe('migratedStatusId', () => {
    const statuses = () => [
      status({ id: 'open', char: ' ', next: 'open' }),
      status({ id: 'migrated', char: '>', isDone: true, next: 'open' }),
      status({ id: 'done', char: 'x', isDone: true, next: 'open' }),
    ]

    it('is set when the id names a valid inactive status', () => {
      const model = buildTaskModel(statuses(), 'plugin', 'migrated')
      expect(model.migratedStatusId).toBe('migrated')
    })

    it('is null when the id names an active status', () => {
      const model = buildTaskModel(statuses(), 'plugin', 'open')
      expect(model.migratedStatusId).toBeNull()
    })

    it('is null for a missing id or when unset', () => {
      expect(buildTaskModel(statuses(), 'plugin', 'ghost').migratedStatusId).toBeNull()
      expect(buildTaskModel(statuses()).migratedStatusId).toBeNull()
    })

    it('does not affect the model id (no cache churn)', () => {
      const withMigrated = buildTaskModel(statuses(), 'plugin', 'migrated')
      const without = buildTaskModel(statuses(), 'plugin')
      expect(withMigrated.id).toBe(without.id)
    })
  })
})
