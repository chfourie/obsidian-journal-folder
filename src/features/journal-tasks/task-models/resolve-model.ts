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

import type {
  TaskFlow,
  TaskModel,
} from '../../../data-access/task-model.type'
import {
  BUILTIN_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
} from '../../../data-access/task-templates'
import { buildTaskModel } from './build-task-model'

// Resolves the active TaskModel from settings.
//
// Resolution chain:
//   1. If `settings.taskFlow` is set (folder-level override) and
//      names an existing flow → use that flow.
//   2. Otherwise → use the flow named by `settings.defaultTaskFlow`.
//   3. If the default flow is also missing → fall back to the
//      built-in Simple template so the model is never empty.
export function resolveTaskModel(settings: {
  taskFlows?: Record<string, TaskFlow>
  defaultTaskFlow?: string
  taskFlow?: string
}): TaskModel {
  const flow = pickFlow(settings)
  return buildTaskModel(flow.statuses, flow.rendering)
}

function pickFlow(settings: {
  taskFlows?: Record<string, TaskFlow>
  defaultTaskFlow?: string
  taskFlow?: string
}): TaskFlow {
  const flows = settings.taskFlows ?? {}
  const folderPick = settings.taskFlow?.trim() ?? ''
  if (
    folderPick &&
    flows[folderPick] &&
    flows[folderPick].statuses.length > 0
  ) {
    return flows[folderPick]
  }
  const defaultPick = settings.defaultTaskFlow ?? ''
  if (
    defaultPick &&
    flows[defaultPick] &&
    flows[defaultPick].statuses.length > 0
  ) {
    return flows[defaultPick]
  }
  return {
    statuses: BUILTIN_TEMPLATES[DEFAULT_TEMPLATE_ID],
    rendering: 'plugin',
  }
}
