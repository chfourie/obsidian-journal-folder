import { describe, expect, it } from 'vitest'
import { resolveTaskModel } from '../../../../src/features/journal-tasks/task-models/resolve-model'
import {
  BUILTIN_TEMPLATES,
  cloneTemplate,
} from '../../../../src/data-access/task-templates'

describe('resolveTaskModel', () => {
  const simpleFlow = {
    statuses: cloneTemplate(BUILTIN_TEMPLATES.simple),
    rendering: 'plugin' as const,
  }
  const bujoFlow = {
    statuses: cloneTemplate(BUILTIN_TEMPLATES['bullet-journal']),
    rendering: 'plugin' as const,
  }

  it('uses the flow named by defaultTaskFlow when no folder override is set', () => {
    const model = resolveTaskModel({
      taskFlows: { Main: simpleFlow, Side: bujoFlow },
      defaultTaskFlow: 'Side',
      taskFlow: '',
    })
    expect(model.statuses.map((s) => s.id)).toEqual(
      bujoFlow.statuses.map((s) => s.id)
    )
  })

  it('honours a folder-level taskFlow override', () => {
    const model = resolveTaskModel({
      taskFlows: { Main: simpleFlow, Side: bujoFlow },
      defaultTaskFlow: 'Main',
      taskFlow: 'Side',
    })
    expect(model.statuses.map((s) => s.id)).toEqual(
      bujoFlow.statuses.map((s) => s.id)
    )
  })

  it('falls back to defaultTaskFlow when the folder override names a missing flow', () => {
    const model = resolveTaskModel({
      taskFlows: { Main: simpleFlow },
      defaultTaskFlow: 'Main',
      taskFlow: 'Ghost',
    })
    expect(model.statuses.map((s) => s.id)).toEqual(
      simpleFlow.statuses.map((s) => s.id)
    )
  })

  it('falls back to the built-in Simple template when both defaults are missing', () => {
    const model = resolveTaskModel({
      taskFlows: {},
      defaultTaskFlow: 'Ghost',
    })
    expect(model.statuses.map((s) => s.id)).toEqual(
      BUILTIN_TEMPLATES.simple.map((s) => s.id)
    )
  })

  it('falls back when settings are completely empty', () => {
    const model = resolveTaskModel({})
    expect(model.statuses.map((s) => s.id)).toEqual(
      BUILTIN_TEMPLATES.simple.map((s) => s.id)
    )
  })

  it('propagates taskClickOpensPicker into the model', () => {
    const off = resolveTaskModel({
      taskFlows: { Main: simpleFlow },
      defaultTaskFlow: 'Main',
    })
    const on = resolveTaskModel({
      taskFlows: { Main: simpleFlow },
      defaultTaskFlow: 'Main',
      taskClickOpensPicker: true,
    })
    // Off: a plain cycling status does not open the picker. On: it does.
    const firstId = simpleFlow.statuses[0].id
    expect(off.opensPickerOnClick(firstId)).toBe(false)
    expect(on.opensPickerOnClick(firstId)).toBe(true)
  })
})
