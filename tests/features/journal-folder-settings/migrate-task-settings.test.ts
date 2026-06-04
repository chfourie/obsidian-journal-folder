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

  describe('task migration (auto-wire migrated status)', () => {
    function flowSettings(
      statuses: JournalFolderSettings['taskFlows'][string]['statuses'],
      migratedStatus?: string
    ): JournalFolderSettings {
      return {
        ...DEFAULT_SETTINGS,
        taskFlows: {
          Flow: { statuses, rendering: 'plugin', migratedStatus },
        },
        defaultTaskFlow: 'Flow',
        taskFlow: '',
      }
    }

    it('sets migratedStatus to the inactive "[>]" status when unset', () => {
      const result = migrateTaskSettings(
        flowSettings(BUILTIN_TEMPLATES['bullet-journal'])
      )
      expect(result.taskFlows.Flow.migratedStatus).toBe('migrated')
    })

    it('is idempotent — re-running keeps the same designation', () => {
      const once = migrateTaskSettings(
        flowSettings(BUILTIN_TEMPLATES['bullet-journal'])
      )
      const twice = migrateTaskSettings(once)
      expect(twice.taskFlows.Flow.migratedStatus).toBe('migrated')
    })

    it('leaves an explicit "" (deliberate clear) alone', () => {
      const result = migrateTaskSettings(
        flowSettings(BUILTIN_TEMPLATES['bullet-journal'], '')
      )
      expect(result.taskFlows.Flow.migratedStatus).toBe('')
    })

    it('leaves a flow without a "[>]" status unset', () => {
      const result = migrateTaskSettings(flowSettings(BUILTIN_TEMPLATES.simple))
      expect(result.taskFlows.Flow.migratedStatus).toBeUndefined()
    })
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

  describe('v3 → v4/v5 (sidebar task scope: anchor/range + folder)', () => {
    type LegacyScope = JournalFolderSettings & {
      tasksSidebarFolders?: string[]
      tasksSidebarReference?: string
      tasksOnlySidebarReference?: string
    }

    // Strip the v4/v5 fields so we start from a genuine pre-split install.
    function legacyBase(overrides: Partial<LegacyScope> = {}): LegacyScope {
      const next = { ...DEFAULT_SETTINGS } as LegacyScope
      for (const key of [
        'tasksSidebarAnchor',
        'tasksSidebarRange',
        'tasksSidebarFolderMode',
        'tasksSidebarFolder',
        'tasksOnlySidebarAnchor',
        'tasksOnlySidebarRange',
        'tasksOnlySidebarFolderMode',
        'tasksOnlySidebarFolder',
      ] as const) {
        delete (next as Record<string, unknown>)[key]
      }
      return { ...next, ...overrides }
    }

    it('splits the shipped "dynamic" reference into note anchor + day range', () => {
      const result = migrateTaskSettings(
        legacyBase({
          tasksSidebarReference: 'dynamic',
          tasksOnlySidebarReference: 'dynamic',
          tasksSidebarFolders: [],
        })
      )
      expect(result.tasksSidebarAnchor).toBe('note')
      expect(result.tasksSidebarRange).toBe('day')
      expect(result.tasksOnlySidebarAnchor).toBe('note')
      expect(result.tasksOnlySidebarRange).toBe('day')
      expect(
        (result as { tasksSidebarReference?: unknown }).tasksSidebarReference
      ).toBeUndefined()
    })

    it('splits an interim "month" reference into today anchor + month range', () => {
      const result = migrateTaskSettings(
        legacyBase({ tasksSidebarReference: 'month', tasksSidebarFolders: [] })
      )
      expect(result.tasksSidebarAnchor).toBe('today')
      expect(result.tasksSidebarRange).toBe('month')
    })

    it('maps an empty folder list to folder mode "all" for both panels', () => {
      const result = migrateTaskSettings(legacyBase({ tasksSidebarFolders: [] }))
      expect(result.tasksSidebarFolderMode).toBe('all')
      expect(result.tasksSidebarFolder).toBe('')
      expect(result.tasksOnlySidebarFolderMode).toBe('all')
      expect(result.tasksOnlySidebarFolder).toBe('')
      expect(
        (result as { tasksSidebarFolders?: unknown }).tasksSidebarFolders
      ).toBeUndefined()
    })

    it('maps a folder list to "specific" + its first folder for both panels', () => {
      const result = migrateTaskSettings(
        legacyBase({ tasksSidebarFolders: ['Work', 'Journal'] })
      )
      expect(result.tasksSidebarFolderMode).toBe('specific')
      expect(result.tasksSidebarFolder).toBe('Work')
      expect(result.tasksOnlySidebarFolderMode).toBe('specific')
      expect(result.tasksOnlySidebarFolder).toBe('Work')
    })

    it('leaves an already-migrated install untouched (idempotent)', () => {
      const result = migrateTaskSettings({
        ...DEFAULT_SETTINGS,
        tasksSidebarAnchor: 'today',
        tasksSidebarRange: 'week',
        tasksSidebarFolderMode: 'specific',
        tasksSidebarFolder: 'Journal',
      } as JournalFolderSettings)
      expect(result.tasksSidebarAnchor).toBe('today')
      expect(result.tasksSidebarRange).toBe('week')
      expect(result.tasksSidebarFolderMode).toBe('specific')
      expect(result.tasksSidebarFolder).toBe('Journal')
    })
  })
})
