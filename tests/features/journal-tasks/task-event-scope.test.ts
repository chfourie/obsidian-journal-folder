import { describe, expect, it } from 'vitest'
import {
  activeLeafAffectsTaskScope,
  parentPathOf,
  sameFolderPath,
  taskEventAffectsScope,
  type TaskEventScope,
} from '../../../src/features/journal-tasks/task-event-scope'

const scope = (over: Partial<TaskEventScope> = {}): TaskEventScope => ({
  folderMode: 'all',
  folder: '',
  activeNoteFolder: null,
  quartersEnabled: false,
  isJournalFolder: (p) => p === 'Journal' || p === 'Work',
  ...over,
})

describe('parentPathOf', () => {
  it('returns the parent folder of a nested path', () => {
    expect(parentPathOf('Journal/Sub/2026-06-10.md')).toBe('Journal/Sub')
  })

  it('reports the vault root as "/"', () => {
    expect(parentPathOf('2026-06-10.md')).toBe('/')
  })
})

describe('sameFolderPath', () => {
  it('treats "" and "/" as the same (root) folder', () => {
    expect(sameFolderPath('', '/')).toBe(true)
    expect(sameFolderPath('/', '')).toBe(true)
  })

  it('compares regular folder paths exactly', () => {
    expect(sameFolderPath('Journal', 'Journal')).toBe(true)
    expect(sameFolderPath('Journal', 'Work')).toBe(false)
  })
})

describe('taskEventAffectsScope', () => {
  it('ignores non-markdown files', () => {
    expect(taskEventAffectsScope('Journal/photo.png', scope())).toBe(false)
  })

  it('ignores markdown files without a journal basename', () => {
    expect(taskEventAffectsScope('Journal/Scratchpad.md', scope())).toBe(false)
  })

  it('always treats config notes as relevant (topology change)', () => {
    expect(
      taskEventAffectsScope(
        'Anywhere/journal-folder.md',
        scope({ folderMode: 'specific', folder: 'Journal' })
      )
    ).toBe(true)
  })

  it('specific mode matches only the configured folder', () => {
    const s = scope({ folderMode: 'specific', folder: 'Journal' })
    expect(taskEventAffectsScope('Journal/2026-06-10.md', s)).toBe(true)
    expect(taskEventAffectsScope('Work/2026-06-10.md', s)).toBe(false)
  })

  it('note mode matches only the active note folder', () => {
    const s = scope({ folderMode: 'note', activeNoteFolder: 'Work' })
    expect(taskEventAffectsScope('Work/2026-06-10.md', s)).toBe(true)
    expect(taskEventAffectsScope('Journal/2026-06-10.md', s)).toBe(false)
  })

  it('note mode without an active journal note falls back to any journal folder', () => {
    const s = scope({ folderMode: 'note', activeNoteFolder: null })
    expect(taskEventAffectsScope('Journal/2026-06-10.md', s)).toBe(true)
    expect(taskEventAffectsScope('Elsewhere/2026-06-10.md', s)).toBe(false)
  })

  it('specific mode with no folder falls back to any journal folder', () => {
    const s = scope({ folderMode: 'specific', folder: '' })
    expect(taskEventAffectsScope('Work/2026-06-10.md', s)).toBe(true)
    expect(taskEventAffectsScope('Elsewhere/2026-06-10.md', s)).toBe(false)
  })

  it('all mode consults the journal-folder predicate with the parent path', () => {
    const seen: string[] = []
    const s = scope({
      isJournalFolder: (p) => {
        seen.push(p)
        return false
      },
    })
    expect(taskEventAffectsScope('Elsewhere/2026-06-10.md', s)).toBe(false)
    expect(seen).toEqual(['Elsewhere'])
  })

  it('passes "/" as the parent of a root-level file', () => {
    const s = scope({ isJournalFolder: (p) => p === '/' })
    expect(taskEventAffectsScope('2026-06-10.md', s)).toBe(true)
  })

  it('treats a "" specific folder setting and a "/" parent as the same root', () => {
    const s = scope({ folderMode: 'specific', folder: '/' })
    expect(taskEventAffectsScope('2026-06-10.md', s)).toBe(true)
  })

  it('honours quartersEnabled for quarterly basenames', () => {
    const off = scope({ folderMode: 'specific', folder: 'Journal' })
    const on = scope({
      folderMode: 'specific',
      folder: 'Journal',
      quartersEnabled: true,
    })
    expect(taskEventAffectsScope('Journal/2026-Q2.md', off)).toBe(false)
    expect(taskEventAffectsScope('Journal/2026-Q2.md', on)).toBe(true)
  })
})

describe('activeLeafAffectsTaskScope', () => {
  it('is true when the anchor follows the note', () => {
    expect(
      activeLeafAffectsTaskScope({ anchor: 'note', folderMode: 'all' })
    ).toBe(true)
  })

  it('is true when the folder mode follows the note', () => {
    expect(
      activeLeafAffectsTaskScope({ anchor: 'today', folderMode: 'note' })
    ).toBe(true)
  })

  it('is false for leaf-independent scopes', () => {
    expect(
      activeLeafAffectsTaskScope({ anchor: 'today', folderMode: 'all' })
    ).toBe(false)
    expect(
      activeLeafAffectsTaskScope({ anchor: 'today', folderMode: 'specific' })
    ).toBe(false)
  })
})
