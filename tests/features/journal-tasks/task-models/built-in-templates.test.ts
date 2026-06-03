import { describe, expect, it } from 'vitest'
import {
  BUILTIN_TEMPLATES,
  cloneTemplate,
  DEFAULT_TEMPLATE_ID,
  isBuiltInTemplate,
} from '../../../../src/data-access/task-templates'

describe('BUILTIN_TEMPLATES', () => {
  it('ships the four expected templates', () => {
    expect(Object.keys(BUILTIN_TEMPLATES).sort()).toEqual(
      ['bullet-journal', 'gtd', 'kanban', 'simple'].sort()
    )
  })

  it('every status `next` points at another status in the same template', () => {
    for (const [name, statuses] of Object.entries(BUILTIN_TEMPLATES)) {
      const ids = new Set(statuses.map((s) => s.id))
      for (const status of statuses) {
        expect(ids.has(status.next), `${name} → ${status.id}.next`).toBe(true)
      }
    }
  })

  it('bullet-journal contains the delegated status', () => {
    const ids = BUILTIN_TEMPLATES['bullet-journal'].map((s) => s.id)
    expect(ids).toContain('delegated')
  })

  it('gtd uses the [?] character for waiting', () => {
    const waiting = BUILTIN_TEMPLATES.gtd.find((s) => s.id === 'waiting')
    expect(waiting?.char).toBe('?')
  })

  it('kanban is a three-state linear cycle', () => {
    const ids = BUILTIN_TEMPLATES.kanban.map((s) => s.id)
    expect(ids).toEqual(['open', 'in-progress', 'done'])
  })
})

describe('isBuiltInTemplate', () => {
  it('recognises built-in ids', () => {
    expect(isBuiltInTemplate('simple')).toBe(true)
    expect(isBuiltInTemplate('gtd')).toBe(true)
  })

  it('rejects unknown ids', () => {
    expect(isBuiltInTemplate('my-template')).toBe(false)
  })
})

describe('cloneTemplate', () => {
  it('returns a deep copy that can be mutated without affecting the original', () => {
    const copy = cloneTemplate(BUILTIN_TEMPLATES.simple)
    copy[0].label = 'Mutated'
    expect(BUILTIN_TEMPLATES.simple[0].label).not.toBe('Mutated')
  })
})

describe('DEFAULT_TEMPLATE_ID', () => {
  it('points at a real built-in template', () => {
    expect(DEFAULT_TEMPLATE_ID in BUILTIN_TEMPLATES).toBe(true)
  })
})
