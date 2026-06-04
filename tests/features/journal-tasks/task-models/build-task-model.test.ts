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
