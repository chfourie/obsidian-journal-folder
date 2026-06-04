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

import type { App, TFile } from 'obsidian'
import type { JournalNote, JournalTask } from '../../data-access'
import { extractTasks } from './extract-tasks'
import type { TaskModel } from './task-models'

interface CacheEntry {
  mtime: number
  modelId: string
  tasks: JournalTask[]
}

// In-memory per-file cache for parsed tasks. Keyed by path, validated on
// each `getTasks` call against the file's current `stat.mtime` and the
// active model's id. A fresh entry is parsed on miss, evicted entries
// are simply re-parsed next time around. No persistence — the cache
// rebuilds from scratch when the plugin reloads.
export class TaskCache {
  private readonly entries = new Map<string, CacheEntry>()
  // Migration markers stripped from each task's display text so the
  // plugin's task lists don't show the cross-reference (and never a raw
  // `lucide:…` token). Set from settings; changing them clears the cache
  // via the feature's `useSettings`, so cached display text stays fresh.
  private migrationMarkers: string[] = []

  constructor(private readonly app: App) {}

  setMigrationMarkers(markers: string[]): void {
    this.migrationMarkers = markers.filter((m) => m.trim().length > 0)
  }

  async getTasks(
    file: TFile,
    model: TaskModel,
    journalNote: JournalNote
  ): Promise<JournalTask[]> {
    const existing = this.entries.get(file.path)
    const mtime = file.stat?.mtime ?? 0
    if (
      existing &&
      existing.mtime === mtime &&
      existing.modelId === model.id
    ) {
      return existing.tasks
    }
    const content = await this.app.vault.cachedRead(file)
    const tasks = extractTasks(
      content,
      model,
      file,
      journalNote,
      this.migrationMarkers
    )
    this.entries.set(file.path, { mtime, modelId: model.id, tasks })
    return tasks
  }

  invalidate(path: string): void {
    this.entries.delete(path)
  }

  rename(oldPath: string, newPath: string): void {
    const entry = this.entries.get(oldPath)
    if (entry) {
      this.entries.delete(oldPath)
      this.entries.set(newPath, entry)
    }
  }

  clear(): void {
    this.entries.clear()
  }
}
