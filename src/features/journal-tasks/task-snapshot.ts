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
  type TasksSidebarAnchor,
  type TasksSidebarFolderMode,
  type TasksSidebarRange,
  journalNoteFactoryWithSettings,
} from '../../data-access'
import { moment } from 'obsidian'
import { buildReferenceRange, rangeForNote } from './reference-range'
import {
  effectiveUnits,
  findTaskCandidates,
  resolveTaskFolders,
} from './task-scope'
import { sortTasks } from './task-sorting'
import { resolveTaskModel } from './task-models'
import { makeRangeCapFilter } from './task-range-cap'
import type { TaskCache } from './task-cache'

export interface TaskPanelSnapshot {
  tasks: JournalTask[]
  totalBeforeCap: number
  truncated: boolean
}

// The panel-local scope a sidebar passes in. Each surface (combined
// sidebar / tasks-only sidebar) owns its own copy of these fields so
// the two panels don't share state.
export interface TaskSnapshotScope {
  anchor: TasksSidebarAnchor
  range: TasksSidebarRange
  folderMode: TasksSidebarFolderMode
  folder: string
}

// Shared computation used by both the combined journal sidebar and
// the tasks-only sidebar. Reads the current settings, resolves the
// reference range against the active leaf (when anchored on the note),
// walks the configured folders, pulls cached task lists, and returns
// the sort+cap result. Keeps both callers from drifting in the details
// (folder fallback, anchor detection, cap math).
export async function computeTaskSnapshot(
  app: App,
  settings: JournalFolderSettings,
  taskCache: TaskCache,
  // Scope is panel-local: the combined sidebar tasks panel and the
  // tasks-only sidebar each track their own anchor / range / folder
  // mode / folder. Callers pass whichever fields they own; the
  // snapshot doesn't reach into settings for them.
  scope: TaskSnapshotScope
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
    anchor: scope.anchor,
    range: scope.range,
    activeNote,
  })

  const folders = resolveTaskFolders({
    folderMode: scope.folderMode,
    folder: scope.folder,
    activeNoteFolder: activeNote ? (activeFile?.parent?.path ?? '') : null,
    allFolders: findJournalFolderPaths(app),
  })

  const candidates = findTaskCandidates({
    app,
    folders,
    units: effectiveUnits(settings),
    referenceRange,
    settings,
  })

  const model = resolveTaskModel(settings)
  // Category range caps are measured from the same anchor the reference
  // range uses (today, or the active note when anchored on it), so a
  // capped task reaches no further than its cap around that anchor — even
  // under the `all` range.
  const capBase =
    scope.anchor === 'note' && activeNote
      ? activeNote.getMoment()
      : // @ts-ignore — obsidian re-exports moment.
        moment()
  const capFilter = makeRangeCapFilter({
    base: capBase,
    listUnit: scope.range,
    categories: settings.taskCategories,
  })
  const collected: JournalTask[] = []
  for (const candidate of candidates) {
    const noteRange = rangeForNote(candidate.note)
    const tasks = await taskCache.getTasks(
      candidate.file,
      model,
      candidate.note
    )
    for (const t of tasks) {
      if (capFilter(t, noteRange)) collected.push(t)
    }
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
