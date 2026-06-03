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

import {
  BUILTIN_TEMPLATE_LABELS,
  BUILTIN_TEMPLATES,
  cloneTemplate,
  DEFAULT_TEMPLATE_ID,
  isBuiltInTemplate,
  type JournalFolderSettings,
  type TaskRendering,
  type TaskStatus,
} from '../../data-access'

// Settings shape from any pre-flow install. The plugin has been
// through two prior shapes:
//   v0 (`taskModel: 'simple' | 'bullet-journal'`) — original two
//       hardcoded models.
//   v1 (`taskStatuses` + `taskTemplates` + `currentTaskTemplate`)
//       — user-editable status array + saved snapshots + the
//       last-loaded template name. Templates were user-managed.
//   v2 (current — `taskFlows` + `defaultTaskFlow` + per-folder
//       `taskFlow`) — built-in templates are read-only; user-
//       managed entities are named flows.
//
// `migrateTaskSettings` runs on every settings load and is
// idempotent. Once an install is on v2 the helper just hands
// settings straight through.
type LegacyShape = JournalFolderSettings & {
  taskModel?: string
  taskStatuses?: TaskStatus[]
  taskTemplates?: Record<string, TaskStatus[]>
  currentTaskTemplate?: string
  // v2 had a single global rendering setting. v3 stores rendering
  // per-status on `TaskStatus.rendering` so a flow can mix-and-match
  // theme and plugin rendering. Migration stamps every existing
  // status with the prior global value.
  taskCheckboxRendering?: TaskRendering
}

export function migrateTaskSettings(
  settings: LegacyShape
): JournalFolderSettings {
  const next: LegacyShape = { ...settings }

  // ---- v0 → v1 (legacy: collapse taskModel into taskStatuses) --
  if (next.taskModel && (!next.taskStatuses || next.taskStatuses.length === 0)) {
    const templateId = isBuiltInTemplate(next.taskModel)
      ? next.taskModel
      : DEFAULT_TEMPLATE_ID
    next.taskStatuses = cloneTemplate(BUILTIN_TEMPLATES[templateId])
    next.currentTaskTemplate = templateId
  }
  delete next.taskModel

  // ---- v1 → v2 (lift taskStatuses + taskTemplates into taskFlows)
  const needsFlowMigration =
    !next.taskFlows ||
    Object.keys(next.taskFlows).length === 0 ||
    !!next.taskStatuses ||
    !!next.taskTemplates ||
    !!next.currentTaskTemplate
  if (needsFlowMigration) {
    const flows: Record<string, TaskStatus[]> = { ...(next.taskFlows ?? {}) }

    // Promote every user template snapshot into a flow of the same
    // name. User templates never collided with built-in template ids
    // (the v1 save-as flow rejected built-in names), so this is a
    // safe direct copy.
    if (next.taskTemplates) {
      for (const [name, statuses] of Object.entries(next.taskTemplates)) {
        if (!flows[name]) flows[name] = cloneTemplate(statuses)
      }
    }

    // Decide the default flow:
    //  - If currentTaskTemplate names a built-in, promote the live
    //    taskStatuses array into a flow labelled after the template
    //    (e.g. "Simple", "Bullet Journal") and select it.
    //  - If currentTaskTemplate names an existing user flow, just
    //    select it as the default.
    //  - If neither, fall back to a "Default" flow seeded from the
    //    Simple template.
    let defaultName = ''
    const pointer = next.currentTaskTemplate ?? ''
    if (isBuiltInTemplate(pointer)) {
      const seed =
        next.taskStatuses && next.taskStatuses.length > 0
          ? next.taskStatuses
          : BUILTIN_TEMPLATES[pointer]
      defaultName = uniqueName(BUILTIN_TEMPLATE_LABELS[pointer], flows)
      flows[defaultName] = cloneTemplate(seed)
    } else if (pointer && flows[pointer]) {
      defaultName = pointer
    } else if (next.taskStatuses && next.taskStatuses.length > 0) {
      defaultName = uniqueName('Default', flows)
      flows[defaultName] = cloneTemplate(next.taskStatuses)
    }

    if (Object.keys(flows).length === 0) {
      defaultName = 'Default'
      flows[defaultName] = cloneTemplate(BUILTIN_TEMPLATES[DEFAULT_TEMPLATE_ID])
    } else if (!defaultName || !flows[defaultName]) {
      defaultName = Object.keys(flows)[0]
    }

    next.taskFlows = flows
    next.defaultTaskFlow = defaultName
  }
  delete next.taskStatuses
  delete next.taskTemplates
  delete next.currentTaskTemplate

  // Guarantee the per-folder field exists (older installs never
  // wrote it). Empty string = "use defaultTaskFlow".
  if (typeof next.taskFlow !== 'string') next.taskFlow = ''

  // ---- v2 → v3 (lift taskCheckboxRendering onto each status) ---
  const legacyRendering: TaskRendering =
    next.taskCheckboxRendering === 'theme' ? 'theme' : 'plugin'
  const stampedFlows: Record<string, TaskStatus[]> = {}
  for (const [name, statuses] of Object.entries(next.taskFlows)) {
    stampedFlows[name] = statuses.map((status) => ({
      ...status,
      rendering: status.rendering ?? legacyRendering,
    }))
  }
  next.taskFlows = stampedFlows
  delete next.taskCheckboxRendering

  return next as JournalFolderSettings
}

// Generates a unique flow name within `flows`. If `base` is free,
// uses it as-is; otherwise appends an incrementing suffix until
// the name doesn't collide.
function uniqueName(
  base: string,
  flows: Record<string, TaskStatus[]>
): string {
  if (!flows[base]) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base} ${i}`
    if (!flows[candidate]) return candidate
  }
  return `${base} ${Date.now()}`
}
