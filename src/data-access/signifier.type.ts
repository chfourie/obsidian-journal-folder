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

import type { IconSpec } from './task-model.type'

// A signifier binds an icon to one or more tags. When a configured tag
// (e.g. `#important`) appears in rendered content the tag is replaced by /
// annotated with this icon. Signifiers are not limited to tasks — they
// apply to any rendered markdown. They are **global only**: never
// overridable per task-flow or per folder.
//
// The icon reuses the task-status `IconSpec` shape so signifiers share the
// plugin's existing Lucide / emoji pickers and colour-token palette.
// `lucide` icons honour `icon.color`; emoji ignore it (same rule as task
// status icons).
export interface Signifier {
  // Stable slug used as the dictionary-independent identity (e.g.
  // `'priority'`). Referenced by `JournalTask.signifierIds` and the
  // "modify signifiers on current line" picker.
  id: string
  // Human-readable name shown in the settings editor and the picker.
  label: string
  // Tag names **without** the leading `#`. A line carrying any of these
  // tags is decorated with this signifier. `tags[0]` is the *primary*
  // tag — the one the shortcut inserts when adding the signifier.
  tags: string[]
  icon: IconSpec
}

// A task category groups tasks by tag at the top of every task list. Like
// signifiers, categories are **global only**. Categories are an ordered
// list — the editor lets the user reorder them and that order drives the
// section order in the task lists.
// A range cap a category can pin its tasks to. Mirrors the task-list
// range units except `all` — "no cap" is simply leaving `maxRange`
// unset, so `all` would be redundant.
export type TaskCategoryRange =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'

export interface TaskCategory {
  id: string
  label: string
  // Tag names without `#`. A task carrying any of these tags is listed
  // under this category.
  tags: string[]
  // Optional icon for the category section header (same `IconSpec` shape).
  icon?: IconSpec
  // Optional **range cap**. When set, tasks in this category reach no
  // further than this range from the list's anchor: in a list whose
  // range is larger (or `all`), this range is used instead; a smaller
  // list range still wins. When a task belongs to several capped
  // categories, the *smallest* cap applies. Unset = no cap (the task
  // follows the list's range as usual). The task always renders normally
  // in its own note regardless of this setting.
  maxRange?: TaskCategoryRange
}
