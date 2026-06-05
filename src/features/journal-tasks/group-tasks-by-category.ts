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

import type { JournalTask, TaskCategory } from '../../data-access'

export interface CategorySection {
  category: TaskCategory
  tasks: JournalTask[]
}

export interface CategoryGrouping {
  // Category sections in configuration order. A category with no matching
  // tasks is omitted.
  categorySections: CategorySection[]
  // Tasks shown in the normal note-grouped area below the categories:
  // uncategorized tasks always, plus categorized tasks when
  // `showUnderNote` is on.
  noteTasks: JournalTask[]
}

// Splits a sorted task list into category sections (shown at the top of the
// task list) and the remaining note-grouped tasks. A task matching several
// categories appears under EACH of them (its `categoryIds` are all honoured)
// and, controlled by the single global `showUnderNote` flag, optionally also
// in its note group. The incoming `tasks` order is preserved within every
// section, so a pre-applied `sortTasks` carries through. Pure / tested.
export function groupTasksByCategory(
  tasks: JournalTask[],
  categories: readonly TaskCategory[],
  showUnderNote: boolean
): CategoryGrouping {
  const sections: CategorySection[] = categories.map((category) => ({
    category,
    tasks: [],
  }))
  const byId = new Map(sections.map((s) => [s.category.id, s]))
  const noteTasks: JournalTask[] = []

  for (const task of tasks) {
    const matched = task.categoryIds.filter((id) => byId.has(id))
    for (const id of matched) byId.get(id)!.tasks.push(task)
    if (matched.length === 0 || showUnderNote) noteTasks.push(task)
  }

  return {
    categorySections: sections.filter((s) => s.tasks.length > 0),
    noteTasks,
  }
}
