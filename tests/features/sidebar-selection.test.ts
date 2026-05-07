import { describe, expect, it } from 'vitest'
import {
  resolveDynamicSelection,
  resolveSelectedFolder,
} from '../../src/features/journal-folder-sidebar/sidebar-selection'

describe('resolveSelectedFolder', () => {
  it('returns the configured default when it is in the known list', () => {
    expect(resolveSelectedFolder('Daily', ['Archive', 'Daily', 'Work'])).toBe(
      'Daily'
    )
  })

  it('falls back to the first known folder when the default is missing', () => {
    expect(resolveSelectedFolder('Renamed', ['Archive', 'Daily'])).toBe(
      'Archive'
    )
  })

  it('returns empty string when there are no known folders', () => {
    expect(resolveSelectedFolder('Daily', [])).toBe('')
  })

  it("treats an empty configured default as 'no preference'", () => {
    expect(resolveSelectedFolder('', ['Archive', 'Daily'])).toBe('Archive')
  })
})

describe('resolveDynamicSelection', () => {
  const base = {
    activeFilePath: 'Daily/2026-05-07.md',
    activeFileBasename: '2026-05-07',
    activeFileParentPath: 'Daily',
    knownFolders: ['Archive', 'Daily'],
    currentSelection: 'Archive',
    quartersEnabled: false,
  }

  it('switches to the parent folder when the active file is a journal note', () => {
    expect(resolveDynamicSelection(base)).toBe('Daily')
  })

  it('returns null when the active file is not a journal note', () => {
    expect(
      resolveDynamicSelection({
        ...base,
        activeFilePath: 'Daily/Random.md',
        activeFileBasename: 'Random',
      })
    ).toBeNull()
  })

  it("returns null when the file's parent is not a known journal folder", () => {
    expect(
      resolveDynamicSelection({
        ...base,
        activeFileParentPath: 'OtherFolder',
      })
    ).toBeNull()
  })

  it('returns null when the parent already matches the current selection', () => {
    expect(
      resolveDynamicSelection({
        ...base,
        currentSelection: 'Daily',
      })
    ).toBeNull()
  })

  it('returns null when there is no active file', () => {
    expect(
      resolveDynamicSelection({
        ...base,
        activeFilePath: null,
        activeFileBasename: null,
        activeFileParentPath: null,
      })
    ).toBeNull()
  })

  it('honours the quartersEnabled flag for Q-pattern basenames', () => {
    const args = {
      ...base,
      activeFilePath: 'Daily/2026-Q2.md',
      activeFileBasename: '2026-Q2',
    }
    expect(resolveDynamicSelection({ ...args, quartersEnabled: false })).toBeNull()
    expect(resolveDynamicSelection({ ...args, quartersEnabled: true })).toBe(
      'Daily'
    )
  })
})
