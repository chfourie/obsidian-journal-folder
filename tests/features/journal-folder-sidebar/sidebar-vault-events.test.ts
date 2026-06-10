import { describe, expect, it } from 'vitest'
import {
  classifyVaultMutation,
  type VaultMutationInput,
} from '../../../src/features/journal-folder-sidebar/sidebar-vault-events'
import type { TaskEventScope } from '../../../src/features/journal-tasks/task-event-scope'

const taskScope = (over: Partial<TaskEventScope> = {}): TaskEventScope => ({
  folderMode: 'all',
  folder: '',
  activeNoteFolder: null,
  quartersEnabled: false,
  isJournalFolder: (p) => p === 'Journal' || p === 'Work',
  ...over,
})

const input = (over: Partial<VaultMutationInput> = {}): VaultMutationInput => ({
  kind: 'create',
  paths: [],
  isFolderEvent: false,
  selectedFolder: 'Journal',
  taskScope: taskScope(),
  ...over,
})

describe('classifyVaultMutation', () => {
  it('a journal note created in the selected folder bumps the anchor and refreshes tasks, but not the folder list', () => {
    expect(
      classifyVaultMutation(input({ paths: ['Journal/2026-06-10.md'] }))
    ).toEqual({
      refreshKnownFolders: false,
      bumpVault: true,
      refreshTasks: true,
    })
  })

  it('a journal note in another journal folder refreshes tasks only', () => {
    expect(
      classifyVaultMutation(input({ paths: ['Work/2026-06-10.md'] }))
    ).toEqual({
      refreshKnownFolders: false,
      bumpVault: false,
      refreshTasks: true,
    })
  })

  it('a non-journal file outside every scope requires nothing', () => {
    expect(
      classifyVaultMutation(input({ paths: ['Elsewhere/Notes.md'] }))
    ).toEqual({
      refreshKnownFolders: false,
      bumpVault: false,
      refreshTasks: false,
    })
  })

  it('a config-note event refreshes the known-folder list', () => {
    const actions = classifyVaultMutation(
      input({ paths: ['NewPlace/journal-folder.md'] })
    )
    expect(actions.refreshKnownFolders).toBe(true)
    expect(actions.refreshTasks).toBe(true)
  })

  it('a rename checks both the old and the new path', () => {
    const actions = classifyVaultMutation(
      input({
        kind: 'rename',
        // Moved out of the selected folder: the old path still matters
        // for the anchor's sibling snapshot.
        paths: ['Archive/2026-06-10.md', 'Journal/2026-06-10.md'],
      })
    )
    expect(actions.bumpVault).toBe(true)
  })

  it('a rename of a config note away from its folder refreshes the folder list via the old path', () => {
    const actions = classifyVaultMutation(
      input({
        kind: 'rename',
        paths: ['Journal/renamed.md', 'Journal/journal-folder.md'],
      })
    )
    expect(actions.refreshKnownFolders).toBe(true)
  })

  it('skips the task refresh when the task panel is disabled', () => {
    expect(
      classifyVaultMutation(
        input({ paths: ['Work/2026-06-10.md'], taskScope: null })
      ).refreshTasks
    ).toBe(false)
  })

  it('treats the "" selected folder and a root-level file as the same root', () => {
    expect(
      classifyVaultMutation(
        input({ paths: ['2026-06-10.md'], selectedFolder: '' })
      ).bumpVault
    ).toBe(true)
  })

  it('folder creation is inert (its files arrive as separate events)', () => {
    expect(
      classifyVaultMutation(
        input({ kind: 'create', paths: ['NewFolder'], isFolderEvent: true })
      )
    ).toEqual({
      refreshKnownFolders: false,
      bumpVault: false,
      refreshTasks: false,
    })
  })

  it('folder deletes and renames react conservatively', () => {
    for (const kind of ['delete', 'rename'] as const) {
      expect(
        classifyVaultMutation(
          input({ kind, paths: ['SomeFolder'], isFolderEvent: true })
        )
      ).toEqual({
        refreshKnownFolders: true,
        bumpVault: true,
        refreshTasks: true,
      })
    }
  })

  it('folder deletes skip the task refresh when the panel is disabled', () => {
    expect(
      classifyVaultMutation(
        input({
          kind: 'delete',
          paths: ['SomeFolder'],
          isFolderEvent: true,
          taskScope: null,
        })
      ).refreshTasks
    ).toBe(false)
  })
})
