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

// Re-export the type + templates from data-access so existing
// consumers that import from `task-models` keep working.
export * from '../../../data-access/task-model.type'
export * from '../../../data-access/task-templates'
export * from './build-task-model'
export * from './resolve-model'

// Backward-compat singletons — pre-built models for the two original
// hardcoded flows. Kept so existing call sites (tests, document
// processors) that import a ready-made model still work. New code
// should call `buildTaskModel(settings.taskStatuses)` instead.
import { buildTaskModel } from './build-task-model'
import { BUILTIN_TEMPLATES } from '../../../data-access/task-templates'

export const simpleTaskModel = buildTaskModel(BUILTIN_TEMPLATES.simple)
export const bulletJournalTaskModel = buildTaskModel(
  BUILTIN_TEMPLATES['bullet-journal']
)
