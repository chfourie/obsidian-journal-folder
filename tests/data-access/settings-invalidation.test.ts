import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../src/data-access/journal-folder-settings.type'
import {
  RENDER_INERT_FIELDS,
  SIGNIFIER_RENDER_FIELDS,
  TASK_EDITOR_FIELDS,
  TASK_PARSE_FIELDS,
  readingViewRenderAffected,
  settingsFieldsChanged,
} from '../../src/data-access/settings-invalidation'

function withChange(
  change: Partial<JournalFolderSettings>
): JournalFolderSettings {
  return { ...DEFAULT_SETTINGS, ...change }
}

const taskParseChanged = (next: JournalFolderSettings) =>
  settingsFieldsChanged(DEFAULT_SETTINGS, next, TASK_PARSE_FIELDS)
const taskEditorChanged = (next: JournalFolderSettings) =>
  settingsFieldsChanged(DEFAULT_SETTINGS, next, TASK_EDITOR_FIELDS)
const signifierChanged = (next: JournalFolderSettings) =>
  settingsFieldsChanged(DEFAULT_SETTINGS, next, SIGNIFIER_RENDER_FIELDS)
const rerenders = (next: JournalFolderSettings) =>
  readingViewRenderAffected(DEFAULT_SETTINGS, next)

describe('settingsFieldsChanged', () => {
  it('reports no change for an identical snapshot', () => {
    expect(taskParseChanged(withChange({}))).toBe(false)
    expect(taskEditorChanged(withChange({}))).toBe(false)
    expect(signifierChanged(withChange({}))).toBe(false)
  })

  it('compares structured fields by value, not reference', () => {
    // A rebuilt-but-equal settings object (load / external sync rebuilds
    // everything wholesale) must not register as a change.
    const clone = JSON.parse(
      JSON.stringify(DEFAULT_SETTINGS)
    ) as JournalFolderSettings
    expect(taskParseChanged(clone)).toBe(false)
    expect(signifierChanged(clone)).toBe(false)
    expect(rerenders(clone)).toBe(false)
  })

  it('detects a change inside a structured field', () => {
    const flows = JSON.parse(
      JSON.stringify(DEFAULT_SETTINGS.taskFlows)
    ) as JournalFolderSettings['taskFlows']
    flows.Default.statuses[0].label = 'renamed'
    expect(taskParseChanged(withChange({ taskFlows: flows }))).toBe(true)
  })
})

describe('TASK_PARSE_FIELDS (task-cache invalidation)', () => {
  it('triggers on model / flow changes', () => {
    expect(taskParseChanged(withChange({ defaultTaskFlow: 'Other' }))).toBe(
      true
    )
    expect(taskParseChanged(withChange({ taskFlow: 'BuJo' }))).toBe(true)
  })

  it('triggers on migration-marker changes (stripped from display text)', () => {
    expect(
      taskParseChanged(withChange({ taskMigrationToMarker: '→' }))
    ).toBe(true)
    expect(
      taskParseChanged(withChange({ taskMigrationFromMarker: '←' }))
    ).toBe(true)
  })

  it('triggers on signifier / category changes (matched + stripped at parse)', () => {
    expect(taskParseChanged(withChange({ signifiers: [] }))).toBe(true)
    expect(taskParseChanged(withChange({ taskCategories: [] }))).toBe(true)
  })

  it('triggers on fields baked into cached note titles / tiers', () => {
    expect(
      taskParseChanged(withChange({ dailyNoteTitlePattern: 'DD MMM' }))
    ).toBe(true)
    expect(
      taskParseChanged(withChange({ weeklyNoteShortTitlePattern: 'ww' }))
    ).toBe(true)
    expect(taskParseChanged(withChange({ startOfWeek: 'monday' }))).toBe(true)
    expect(taskParseChanged(withChange({ quartersEnabled: true }))).toBe(true)
  })

  it('does NOT trigger on sidebar scope / UI fields', () => {
    expect(taskParseChanged(withChange({ tasksSidebarRange: 'year' }))).toBe(
      false
    )
    expect(taskParseChanged(withChange({ tasksShowCompleted: false }))).toBe(
      false
    )
    expect(
      taskParseChanged(withChange({ tasksSidebarFolderMode: 'note' }))
    ).toBe(false)
    expect(taskParseChanged(withChange({ sidebarMode: 'static' }))).toBe(false)
    expect(
      taskParseChanged(withChange({ taskInteractionScope: 'everywhere' }))
    ).toBe(false)
  })
})

describe('TASK_EDITOR_FIELDS (workspace.updateOptions for task surfaces)', () => {
  it('triggers on interaction / picker / opacity changes', () => {
    expect(
      taskEditorChanged(withChange({ taskInteractionScope: 'everywhere' }))
    ).toBe(true)
    expect(
      taskEditorChanged(withChange({ taskClickOpensPicker: true }))
    ).toBe(true)
    expect(
      taskEditorChanged(withChange({ taskMigrationReferenceOpacity: 80 }))
    ).toBe(true)
    expect(taskEditorChanged(withChange({ defaultTaskFlow: 'Other' }))).toBe(
      true
    )
  })

  it('does NOT trigger on sidebar scope fields or title patterns', () => {
    expect(
      taskEditorChanged(withChange({ tasksSidebarAnchor: 'today' }))
    ).toBe(false)
    expect(
      taskEditorChanged(withChange({ tasksOnlySidebarShowCompleted: false }))
    ).toBe(false)
    expect(
      taskEditorChanged(withChange({ dailyNoteTitlePattern: 'DD' }))
    ).toBe(false)
  })
})

describe('SIGNIFIER_RENDER_FIELDS', () => {
  it('triggers on every signifier setting', () => {
    expect(signifierChanged(withChange({ signifiers: [] }))).toBe(true)
    expect(
      signifierChanged(withChange({ signifierPlacement: 'margin' }))
    ).toBe(true)
    expect(
      signifierChanged(withChange({ signifierReserveGutter: false }))
    ).toBe(true)
    expect(
      signifierChanged(withChange({ signifierHideTagInReadingView: false }))
    ).toBe(true)
    expect(
      signifierChanged(withChange({ signifierHideTagInLivePreview: false }))
    ).toBe(true)
    expect(
      signifierChanged(withChange({ signifierShowTagsOnActiveLine: true }))
    ).toBe(true)
  })

  it('does NOT trigger on task or sidebar fields', () => {
    expect(signifierChanged(withChange({ taskCategories: [] }))).toBe(false)
    expect(signifierChanged(withChange({ tasksSidebarRange: 'all' }))).toBe(
      false
    )
  })
})

describe('readingViewRenderAffected (rerender(true) gate)', () => {
  it('skips every render-inert field', () => {
    expect(rerenders(withChange({ tasksSidebarRange: 'year' }))).toBe(false)
    expect(rerenders(withChange({ tasksShowCompleted: false }))).toBe(false)
    expect(
      rerenders(withChange({ tasksOnlySidebarFolderMode: 'specific' }))
    ).toBe(false)
    expect(rerenders(withChange({ sidebarMode: 'static' }))).toBe(false)
    expect(rerenders(withChange({ defaultJournalFolder: 'Journal' }))).toBe(
      false
    )
    expect(rerenders(withChange({ taskMigrationPlacement: 'end' }))).toBe(
      false
    )
    expect(rerenders(withChange({ taskMigrationHeading: 'Moved' }))).toBe(
      false
    )
    expect(rerenders(withChange({ templatesMigratedToFiles: true }))).toBe(
      false
    )
    expect(rerenders(withChange({ todayButtonPlacement: 'ribbon' }))).toBe(
      false
    )
    expect(rerenders(withChange({ editModeIndicator: true }))).toBe(false)
  })

  it('fires on render-relevant fields', () => {
    expect(rerenders(withChange({ signifiers: [] }))).toBe(true)
    expect(rerenders(withChange({ signifierPlacement: 'margin' }))).toBe(true)
    expect(rerenders(withChange({ taskMigrationToMarker: '→' }))).toBe(true)
    expect(
      rerenders(withChange({ taskMigrationReferenceOpacity: 70 }))
    ).toBe(true)
    expect(
      rerenders(withChange({ taskInteractionScope: 'everywhere' }))
    ).toBe(true)
    expect(rerenders(withChange({ dailyNoteTitlePattern: 'DD' }))).toBe(true)
    expect(rerenders(withChange({ tasksMaxItems: 50 }))).toBe(true)
    expect(rerenders(withChange({ taskCategoryShowUnderNote: true }))).toBe(
      true
    )
    expect(rerenders(withChange({ quartersEnabled: true }))).toBe(true)
  })

  it('fires for a field unknown to the inert list (fail-safe default)', () => {
    // A future field that nobody classified must default to re-rendering.
    const next = {
      ...DEFAULT_SETTINGS,
      someFutureField: 'x',
    } as JournalFolderSettings
    expect(readingViewRenderAffected(DEFAULT_SETTINGS, next)).toBe(true)
  })

  it('keeps every inert field a real settings key (drift guard)', () => {
    for (const field of RENDER_INERT_FIELDS) {
      expect(field in DEFAULT_SETTINGS).toBe(true)
    }
  })
})
