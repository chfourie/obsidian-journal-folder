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

// Starts a clean install on the new v3 shape so we can layer
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
  describe('v0 → v3 (legacy taskModel)', () => {
    it('seeds a flow from a legacy taskModel = simple and selects it as default', () => {
      const result = migrateTaskSettings({ ...base(), taskModel: 'simple' })
      expect(result.defaultTaskFlow).toBe('Simple')
      expect(result.taskFlows.Simple.statuses.map((s) => s.id)).toEqual(
        BUILTIN_TEMPLATES.simple.map((s) => s.id)
      )
      expect(result.taskFlows.Simple.rendering).toBe('plugin')
      expect((result as LegacyShape).taskModel).toBeUndefined()
    })

    it('seeds from a legacy taskModel = bullet-journal', () => {
      const result = migrateTaskSettings({
        ...base(),
        taskModel: 'bullet-journal',
      })
      expect(result.defaultTaskFlow).toBe('Bullet Journal')
      expect(
        result.taskFlows['Bullet Journal'].statuses.map((s) => s.id)
      ).toContain('delegated')
    })

    it('falls back to Simple for an unknown legacy taskModel', () => {
      const result = migrateTaskSettings({ ...base(), taskModel: 'mystery' })
      expect(result.defaultTaskFlow).toBe('Simple')
    })
  })

  describe('v1 → v3 (taskStatuses + taskTemplates + currentTaskTemplate)', () => {
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
      expect(result.taskFlows['My Workflow'].statuses).toEqual(customStatuses)
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
          shell: { shape: 'circle' as const },
          icon: { source: { kind: 'none' as const } },
        },
      ]
      const result = migrateTaskSettings({
        ...base(),
        taskStatuses: live,
        currentTaskTemplate: 'simple',
      } as LegacyShape)
      expect(result.taskFlows.Simple).toBeDefined()
      expect(result.defaultTaskFlow).toBe('Simple')
      expect(result.taskFlows.Simple.statuses).toEqual(live)
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
      taskFlows: {
        Custom: { statuses: BUILTIN_TEMPLATES.gtd, rendering: 'plugin' },
      },
      defaultTaskFlow: 'Custom',
      taskFlow: '',
    }
    const result = migrateTaskSettings(seed)
    expect(result.defaultTaskFlow).toBe('Custom')
    expect(result.taskFlows.Custom.statuses).toEqual(BUILTIN_TEMPLATES.gtd)
    expect(result.taskFlows.Custom.rendering).toBe('plugin')
  })

  describe('v2 / v3a → v3 (rendering lifted to flow level)', () => {
    it('uses the legacy global taskCheckboxRendering when no per-status rendering is present', () => {
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
            },
          ],
        } as unknown as JournalFolderSettings['taskFlows'],
        defaultTaskFlow: 'Custom',
        taskFlow: '',
        taskCheckboxRendering: 'theme',
      } as JournalFolderSettings & { taskCheckboxRendering: 'theme' })
      expect(result.taskFlows.Custom.rendering).toBe('theme')
      expect(
        (result as JournalFolderSettings & { taskCheckboxRendering?: string })
          .taskCheckboxRendering
      ).toBeUndefined()
    })

    it('treats any per-status theme rendering as theme for the whole flow', () => {
      const result = migrateTaskSettings({
        ...DEFAULT_SETTINGS,
        taskFlows: {
          Mix: [
            {
              id: 'open',
              label: 'Open',
              char: ' ',
              isDone: false,
              next: 'done',
              rendering: 'theme',
              shell: { shape: 'circle' as const },
              icon: { source: { kind: 'none' as const } },
            },
            {
              id: 'done',
              label: 'Done',
              char: 'x',
              isDone: true,
              next: 'open',
              rendering: 'plugin',
              shell: { shape: 'circle' as const },
              icon: { source: { kind: 'none' as const } },
            },
          ],
        } as unknown as JournalFolderSettings['taskFlows'],
        defaultTaskFlow: 'Mix',
        taskFlow: '',
      } as JournalFolderSettings)
      expect(result.taskFlows.Mix.rendering).toBe('theme')
      // Per-status rendering field is stripped during lift.
      expect(
        (result.taskFlows.Mix.statuses[0] as { rendering?: string }).rendering
      ).toBeUndefined()
    })

    it('defaults rendering to "plugin" when no legacy value exists', () => {
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
            },
          ],
        } as unknown as JournalFolderSettings['taskFlows'],
        defaultTaskFlow: 'Custom',
        taskFlow: '',
      } as JournalFolderSettings)
      expect(result.taskFlows.Custom.rendering).toBe('plugin')
    })
  })

  it('guarantees a taskFlow field exists', () => {
    const partial = { ...DEFAULT_SETTINGS } as LegacyShape
    delete (partial as { taskFlow?: string }).taskFlow
    const result = migrateTaskSettings(partial)
    expect(result.taskFlow).toBe('')
  })
})
