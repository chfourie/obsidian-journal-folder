/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { FOLDER_CONFIG_FILENAME } from '../../data-access'
// Imported from the concrete module (not the feature index) so this file
// stays loadable in plain-TS test environments — the index re-exports
// Svelte components.
import {
  parentPathOf,
  sameFolderPath,
  taskEventAffectsScope,
  type TaskEventScope,
} from '../journal-tasks/task-event-scope'

export type VaultMutationKind = 'create' | 'delete' | 'rename'

export interface VaultMutationInput {
  kind: VaultMutationKind
  // The event target's vault path, plus the old path for renames.
  paths: string[]
  // True when the event's subject is a folder rather than a file.
  isFolderEvent: boolean
  // The sidebar's currently selected journal folder (the calendar anchor's
  // home — only its direct children feed the anchor's sibling snapshot).
  selectedFolder: string
  // Task-panel event scope, or `null` when the task panel is disabled.
  taskScope: TaskEventScope | null
}

export interface VaultMutationActions {
  refreshKnownFolders: boolean
  bumpVault: boolean
  refreshTasks: boolean
}

// Decides which of the combined sidebar's three vault-mutation reactions a
// create/delete/rename actually requires, so the view can skip the
// expensive ones (a full-vault folder walk, an anchor-note rebuild, a task
// snapshot recompute) for the events — the vast majority — that can't
// change their result.
export function classifyVaultMutation(
  input: VaultMutationInput
): VaultMutationActions {
  if (input.isFolderEvent) {
    // A newly created folder is empty — its contents (config note
    // included) arrive as separate file events. A folder delete/rename
    // can move or remove an entire journal folder in one event, so react
    // conservatively to those.
    if (input.kind === 'create') {
      return {
        refreshKnownFolders: false,
        bumpVault: false,
        refreshTasks: false,
      }
    }
    return {
      refreshKnownFolders: true,
      bumpVault: true,
      refreshTasks: input.taskScope !== null,
    }
  }
  const taskScope = input.taskScope
  return {
    // Only a `journal-folder.md` appearing, disappearing, or moving can
    // change the known-folder list.
    refreshKnownFolders: input.paths.some(
      (p) => (p.split('/').pop() ?? p) === FOLDER_CONFIG_FILENAME
    ),
    bumpVault: input.paths.some((p) =>
      sameFolderPath(parentPathOf(p), input.selectedFolder)
    ),
    refreshTasks:
      taskScope !== null &&
      input.paths.some((p) => taskEventAffectsScope(p, taskScope)),
  }
}
