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
import {
  anchorRange,
  buildReferenceRange,
  rangeForNote,
} from './reference-range'
import {
  effectiveUnits,
  findTaskCandidates,
  resolveTaskFolders,
} from './task-scope'
import { sortTasks } from './task-sorting'
import { resolveTaskModel } from './task-models'
import { makeRangeCapFilter } from './task-range-cap'
import { mapWithConcurrency, TASK_READ_CONCURRENCY } from './concurrency'
import type { TaskCache } from './task-cache'
import type { TaskModel } from './task-models'

export interface TaskPanelSnapshot {
  tasks: JournalTask[]
  // Count of the *visible* population (post completed-filter) before the
  // size cap — the header's task count and the footer's "of N" both read
  // this, so the two can't contradict each other.
  totalBeforeCap: number
  truncated: boolean
  // Every completed task hidden by the filter, across the whole scope
  // (not just the capped slice). 0 when completed tasks are shown.
  hiddenCompletedCount: number
}

// Completed-filter + size-cap in the canonical order: filter first, so
// the cap only trims visible tasks and `hiddenCompletedCount` reflects
// every completed task in scope. Shared by the sidebar snapshot and the
// in-note block so the surfaces can't drift on the count semantics.
export function capVisibleTasks(
  sorted: JournalTask[],
  opts: {
    showCompleted: boolean
    model: Pick<TaskModel, 'isDone'>
    maxItems: number
  }
): TaskPanelSnapshot {
  const visible = opts.showCompleted
    ? sorted
    : sorted.filter((t) => !opts.model.isDone(t.status))
  const capped = visible.slice(0, opts.maxItems)
  return {
    tasks: capped,
    totalBeforeCap: visible.length,
    truncated: visible.length > capped.length,
    hiddenCompletedCount: opts.showCompleted
      ? 0
      : sorted.length - visible.length,
  }
}

// The panel-local scope a sidebar passes in. Each surface (combined
// sidebar / tasks-only sidebar) owns its own copy of these fields so
// the two panels don't share state.
export interface TaskSnapshotScope {
  anchor: TasksSidebarAnchor
  range: TasksSidebarRange
  folderMode: TasksSidebarFolderMode
  folder: string
  // The panel's completed-tasks toggle. Applied *before* the size cap
  // (see `capVisibleTasks`) so hidden completed tasks never consume cap
  // slots and the hidden count covers the whole scope.
  showCompleted: boolean
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
    allFolders: () => findJournalFolderPaths(app),
  })

  const candidates = findTaskCandidates({
    app,
    folders,
    units: effectiveUnits(settings),
    referenceRange,
    settings,
  })

  const model = resolveTaskModel(settings)
  // Category range caps are expanded across the same anchor range the
  // reference range uses (today, or the active note's whole period when
  // anchored on it), so a capped task reaches no further than its cap — even
  // under the `all` range. The list range itself does the rest of the work.
  const capFilter = makeRangeCapFilter({
    anchor: anchorRange({ anchor: scope.anchor, activeNote }),
    listUnit: scope.range,
    categories: settings.taskCategories,
  })
  // Pooled reads: on a cold cache each `getTasks` is a real
  // `cachedRead`, and awaiting them serially made a large folder pay N
  // sequential round-trips. Results come back in candidate order.
  const taskLists = await mapWithConcurrency(
    candidates,
    TASK_READ_CONCURRENCY,
    (candidate) => taskCache.getTasks(candidate.file, model, candidate.note)
  )
  const collected: JournalTask[] = []
  candidates.forEach((candidate, i) => {
    const noteRange = rangeForNote(candidate.note)
    for (const t of taskLists[i]) {
      if (capFilter(t, noteRange)) collected.push(t)
    }
  })
  return capVisibleTasks(sortTasks(collected), {
    showCompleted: scope.showCompleted,
    model,
    maxItems: settings.tasksMaxItems,
  })
}
