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

import { type App, TFile } from 'obsidian'
import {
  findJournalFolderPaths,
  isJournalFileBasename,
  type JournalFolderSettings,
  type JournalNote,
  type JournalTask,
  type TasksSidebarReference,
  journalNoteFactoryWithSettings,
} from '../../data-access'
import { buildReferenceRange } from './reference-range'
import { effectiveUnits, findTaskCandidates } from './task-scope'
import { sortTasks } from './task-sorting'
import { resolveTaskModel } from './task-models'
import type { TaskCache } from './task-cache'

export interface TaskPanelSnapshot {
  tasks: JournalTask[]
  totalBeforeCap: number
  truncated: boolean
}

// Shared computation used by both the combined journal sidebar and
// the new tasks-only sidebar. Reads the current settings, resolves
// the reference range against the active leaf (when in `dynamic`
// mode), walks the configured folders, pulls cached task lists, and
// returns the sort+cap result. Keeps both callers from drifting in
// the details (folder fallback, dynamic-mode detection, cap math).
export async function computeTaskSnapshot(
  app: App,
  settings: JournalFolderSettings,
  taskCache: TaskCache,
  // Reference mode is panel-local: the combined sidebar tasks panel and
  // the tasks-only sidebar each track their own toggle. Callers pass
  // whichever field they own (`tasksSidebarReference` /
  // `tasksOnlySidebarReference`); the snapshot doesn't reach into
  // settings for it.
  referenceMode: TasksSidebarReference = settings.tasksSidebarReference
): Promise<TaskPanelSnapshot> {
  const activeFile = app.workspace.getActiveFile?.()
  const factory = journalNoteFactoryWithSettings(settings)
  const activeNote: JournalNote | null =
    activeFile instanceof TFile &&
    isJournalFileBasename(activeFile.basename, !!settings.quartersEnabled)
      ? (() => {
          try {
            return factory(activeFile)
          } catch {
            return null
          }
        })()
      : null

  const referenceRange = buildReferenceRange({
    host: 'sidebar',
    referenceMode,
    activeNote,
  })

  const folders =
    referenceMode === 'dynamic' && activeNote
      ? [activeFile?.parent?.path ?? '']
      : settings.tasksSidebarFolders.length > 0
        ? settings.tasksSidebarFolders
        : findJournalFolderPaths(app)

  const candidates = findTaskCandidates({
    app,
    folders,
    units: effectiveUnits(settings),
    referenceRange,
    settings,
  })

  const model = resolveTaskModel(settings)
  const collected: JournalTask[] = []
  for (const candidate of candidates) {
    const tasks = await taskCache.getTasks(
      candidate.file,
      model,
      candidate.note
    )
    for (const t of tasks) collected.push(t)
  }
  const sorted = sortTasks(collected)
  const totalBeforeCap = sorted.length
  const capped = sorted.slice(0, settings.tasksMaxItems)
  return {
    tasks: capped,
    totalBeforeCap,
    truncated: totalBeforeCap > capped.length,
  }
}
