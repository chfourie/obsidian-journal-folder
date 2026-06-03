import { describe, expect, it } from 'vitest'
import { migrateTaskSettings } from '../../../src/features/journal-folder-settings/migrate-task-settings'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../../src/data-access'
import { BUILTIN_TEMPLATES } from '../../../src/data-access/task-templates'

type LegacyShape = JournalFolderSettings & {
  taskModel?: string
  taskStatuses?: unknown
  taskTemplates?: Record<string, unknown>
  currentTaskTemplate?: string
}

// Starts a clean install on the new v2 shape so we can layer
// legacy fields onto it for migration tests.
function base(): LegacyShape {
  return {
    ...DEFAULT_SETTINGS,
    taskFlows: {},
    defaultTaskFlow: '',
    taskFlow: '',
  } as LegacyShape
}

describe('migrateTaskSettings', () => {
  describe('v0 → v2 (legacy taskModel)', () => {
    it('seeds a flow from a legacy taskModel = simple and selects it as default', () => {
      const result = migrateTaskSettings({ ...base(), taskModel: 'simple' })
      expect(result.defaultTaskFlow).toBe('Simple')
      expect(result.taskFlows.Simple.map((s) => s.id)).toEqual(
        BUILTIN_TEMPLATES.simple.map((s) => s.id)
      )
      expect((result as LegacyShape).taskModel).toBeUndefined()
    })

    it('seeds from a legacy taskModel = bullet-journal', () => {
      const result = migrateTaskSettings({
        ...base(),
        taskModel: 'bullet-journal',
      })
      expect(result.defaultTaskFlow).toBe('Bullet Journal')
      expect(result.taskFlows['Bullet Journal'].map((s) => s.id)).toContain(
        'delegated'
      )
    })

    it('falls back to Simple for an unknown legacy taskModel', () => {
      const result = migrateTaskSettings({ ...base(), taskModel: 'mystery' })
      expect(result.defaultTaskFlow).toBe('Simple')
    })
  })

  describe('v1 → v2 (taskStatuses + taskTemplates + currentTaskTemplate)', () => {
    it('promotes user templates into flows', () => {
      const customStatuses = [
        {
          id: 'todo',
          label: 'Todo',
          char: ' ',
          isDone: false,
          next: 'todo',
          shell: { shape: 'none' as const },
          icon: { source: { kind: 'none' as const } },
        },
      ]
      const result = migrateTaskSettings({
        ...base(),
        taskTemplates: { 'My Workflow': customStatuses } as Record<string, unknown>,
        taskStatuses: customStatuses,
        currentTaskTemplate: 'My Workflow',
      } as LegacyShape)
      expect(result.taskFlows['My Workflow']).toBeDefined()
      expect(result.defaultTaskFlow).toBe('My Workflow')
      expect((result as LegacyShape).taskTemplates).toBeUndefined()
      expect((result as LegacyShape).taskStatuses).toBeUndefined()
      expect((result as LegacyShape).currentTaskTemplate).toBeUndefined()
    })

    it('promotes the live taskStatuses array when currentTaskTemplate names a built-in', () => {
      const live = [
        {
          id: 'open',
          label: 'Open',
          char: ' ',
          isDone: false,
          next: 'open',
          rendering: 'plugin' as const,
          shell: { shape: 'circle' as const },
          icon: { source: { kind: 'none' as const } },
        },
      ]
      const result = migrateTaskSettings({
        ...base(),
        taskStatuses: live,
        currentTaskTemplate: 'simple',
      } as LegacyShape)
      // Promoted under the template's label.
      expect(result.taskFlows.Simple).toBeDefined()
      expect(result.defaultTaskFlow).toBe('Simple')
      // The promoted flow carries the user's live statuses, not the
      // pristine built-in template.
      expect(result.taskFlows.Simple).toEqual(live)
    })

    it('seeds a Default flow when nothing else is available', () => {
      const result = migrateTaskSettings(base())
      expect(result.taskFlows.Default).toBeDefined()
      expect(result.defaultTaskFlow).toBe('Default')
    })
  })

  it('leaves an already-migrated v3 install with the same flow contents', () => {
    const seed: JournalFolderSettings = {
      ...DEFAULT_SETTINGS,
      taskFlows: { Custom: BUILTIN_TEMPLATES.gtd },
      defaultTaskFlow: 'Custom',
      taskFlow: '',
    }
    const result = migrateTaskSettings(seed)
    expect(result.defaultTaskFlow).toBe('Custom')
    // The v3 rendering stamp rebuilds the flow array on every run
    // (idempotent — preserves existing `rendering`), so the array
    // reference changes but contents match.
    expect(result.taskFlows.Custom).toEqual(BUILTIN_TEMPLATES.gtd)
  })

  it('stamps every status with the legacy global rendering value (v2 → v3)', () => {
    const result = migrateTaskSettings({
      ...DEFAULT_SETTINGS,
      taskFlows: {
        Custom: [
          {
            id: 'open',
            label: 'Open',
            char: ' ',
            isDone: false,
            next: 'open',
            shell: { shape: 'circle' as const },
            icon: { source: { kind: 'none' as const } },
          } as Parameters<typeof migrateTaskSettings>[0]['taskFlows']['Custom'][number],
        ],
      },
      defaultTaskFlow: 'Custom',
      taskFlow: '',
      taskCheckboxRendering: 'theme',
    } as LegacyShape)
    expect(result.taskFlows.Custom[0].rendering).toBe('theme')
    expect((result as LegacyShape).taskCheckboxRendering).toBeUndefined()
  })

  it('defaults rendering to "plugin" when no legacy global value exists', () => {
    const result = migrateTaskSettings({
      ...DEFAULT_SETTINGS,
      taskFlows: {
        Custom: [
          {
            id: 'open',
            label: 'Open',
            char: ' ',
            isDone: false,
            next: 'open',
            shell: { shape: 'circle' as const },
            icon: { source: { kind: 'none' as const } },
          } as Parameters<typeof migrateTaskSettings>[0]['taskFlows']['Custom'][number],
        ],
      },
      defaultTaskFlow: 'Custom',
      taskFlow: '',
    } as LegacyShape)
    expect(result.taskFlows.Custom[0].rendering).toBe('plugin')
  })

  it('guarantees a taskFlow field exists', () => {
    const partial = { ...DEFAULT_SETTINGS } as LegacyShape
    delete (partial as { taskFlow?: string }).taskFlow
    const result = migrateTaskSettings(partial)
    expect(result.taskFlow).toBe('')
  })
})
