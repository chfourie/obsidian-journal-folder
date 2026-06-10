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
  type TaskFlow,
  type TaskRendering,
  type TasksSidebarAnchor,
  type TasksSidebarFolderMode,
  type TasksSidebarRange,
  type TaskStatus,
} from '../../data-access'

// Settings shape from any pre-flow install. The plugin has been
// through several prior shapes:
//   v0 (`taskModel: 'simple' | 'bullet-journal'`) — original two
//       hardcoded models.
//   v1 (`taskStatuses` + `taskTemplates` + `currentTaskTemplate`)
//       — user-editable status array + saved snapshots + the
//       last-loaded template name. Templates were user-managed.
//   v2 (`taskFlows: Record<string, TaskStatus[]>` +
//       `defaultTaskFlow` + per-folder `taskFlow`) — built-in
//       templates became read-only; user-managed entities are named
//       flows.
//   v3a (interim — `TaskStatus.rendering`) — rendering was promoted
//       from a global field into a per-status field on `TaskStatus`.
//       Reverted because mixing plugin-rendered and theme-rendered
//       statuses inside one nested list paints unreliably.
//   v3 (current — `TaskFlow = { statuses, rendering }`) — rendering
//       sits at flow level, one mode per flow.
//
// `migrateTaskSettings` runs on every settings load and is
// idempotent. Once an install is on v3 the helper just hands
// settings straight through.
type LegacyShape = JournalFolderSettings & {
  taskModel?: string
  taskStatuses?: TaskStatus[]
  taskTemplates?: Record<string, TaskStatus[]>
  currentTaskTemplate?: string
  taskCheckboxRendering?: TaskRendering
  // Pre-v4: a single shared list of folders the sidebar `Today` scope
  // considered (empty = all). Split into per-panel mode + folder.
  tasksSidebarFolders?: string[]
  // Pre-v5: a single combined reference per panel. Split into a
  // separate anchor + range. Shipped values were `'today' | 'dynamic'`;
  // an unreleased interim also used `'week' | 'month' | 'quarter' |
  // 'note'`.
  tasksSidebarReference?: string
  tasksOnlySidebarReference?: string
}

// Internal shape used while migrating: `taskFlows` may still be the
// legacy `TaskStatus[]` form before v3 lifts it into `TaskFlow`.
type MigratingShape = Omit<LegacyShape, 'taskFlows'> & {
  taskFlows?: Record<string, TaskStatus[] | TaskFlow>
}

export function migrateTaskSettings(
  settings: LegacyShape
): JournalFolderSettings {
  const next: MigratingShape = { ...settings }

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
    const flows: Record<string, TaskStatus[] | TaskFlow> = {
      ...(next.taskFlows ?? {}),
    }

    if (next.taskTemplates) {
      for (const [name, statuses] of Object.entries(next.taskTemplates)) {
        if (!flows[name]) flows[name] = cloneTemplate(statuses)
      }
    }

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

  if (typeof next.taskFlow !== 'string') next.taskFlow = ''

  // ---- v2 → v3 (lift rendering from per-status / legacy global
  // onto per-flow). Any flow already in the v3 object shape passes
  // through untouched.
  const legacyGlobalRendering: TaskRendering =
    next.taskCheckboxRendering === 'theme' ? 'theme' : 'plugin'
  const upgradedFlows: Record<string, TaskFlow> = {}
  for (const [name, value] of Object.entries(next.taskFlows ?? {})) {
    if (isTaskFlow(value)) {
      upgradedFlows[name] = value
      continue
    }
    const statuses = value as Array<TaskStatus & { rendering?: TaskRendering }>
    // A single rendering per flow. If any v3a per-status `rendering`
    // marked the flow as `theme`, treat the whole flow as theme —
    // that's the safer choice for users who explicitly opted out of
    // plugin painting on at least one status. Otherwise fall back to
    // the legacy global value (or `'plugin'`).
    const flowRendering: TaskRendering = statuses.some(
      (s) => s.rendering === 'theme'
    )
      ? 'theme'
      : statuses.some((s) => s.rendering === 'plugin')
        ? 'plugin'
        : legacyGlobalRendering
    const stripped: TaskStatus[] = statuses.map(
      ({ rendering: _omit, ...rest }) => rest
    )
    upgradedFlows[name] = { statuses: stripped, rendering: flowRendering }
  }
  ;(next as JournalFolderSettings).taskFlows = upgradedFlows
  delete next.taskCheckboxRendering

  // ---- v3 → v6 (task migration) ----
  // Auto-wire a flow's migrated status the first time it's seen:
  // a flow with no explicit `migratedStatus` that happens to contain
  // the community-conventional `[>]` migrated status (inactive) gets
  // it set automatically, so Bullet-Journal-seeded flows migrate
  // out of the box. Idempotent — only fills an undefined field, and
  // leaves an explicit choice alone, including a deliberate clear
  // (`MIGRATED_STATUS_CLEARED`, `''` — !== undefined, so it skips).
  for (const flow of Object.values(upgradedFlows)) {
    if (flow.migratedStatus !== undefined) continue
    const migrated = flow.statuses.find((s) => s.char === '>' && s.isDone)
    if (migrated) flow.migratedStatus = migrated.id
  }

  // ---- v3 → v4/v5 (sidebar task scope) ----
  // Two splits land here:
  //   (v4) folder scope moved from a single shared
  //        `tasksSidebarFolders: string[]` (empty = all) to a per-panel
  //        folder *mode* + single specific folder.
  //   (v5) the combined `tasksSidebarReference` / `tasksOnlySidebarReference`
  //        split into a separate anchor (`today` | `note`) + range
  //        (`day` | `week` | `month` | `quarter` | `year` | `all`).
  // Seed the new fields from the legacy values when present, then drop
  // the legacy keys. Both folder fields seed from the one shared array.
  if (next.tasksSidebarReference !== undefined) {
    const { anchor, range } = splitReference(next.tasksSidebarReference)
    next.tasksSidebarAnchor = anchor
    next.tasksSidebarRange = range
    delete next.tasksSidebarReference
  }
  if (next.tasksOnlySidebarReference !== undefined) {
    const { anchor, range } = splitReference(next.tasksOnlySidebarReference)
    next.tasksOnlySidebarAnchor = anchor
    next.tasksOnlySidebarRange = range
    delete next.tasksOnlySidebarReference
  }
  const legacyFolders = next.tasksSidebarFolders
  if (Array.isArray(legacyFolders)) {
    const mode: TasksSidebarFolderMode =
      legacyFolders.length > 0 ? 'specific' : 'all'
    const folder = legacyFolders.length > 0 ? String(legacyFolders[0]) : ''
    next.tasksSidebarFolderMode = mode
    next.tasksSidebarFolder = folder
    next.tasksOnlySidebarFolderMode = mode
    next.tasksOnlySidebarFolder = folder
    delete next.tasksSidebarFolders
  }

  return next as JournalFolderSettings
}

// Maps a legacy combined reference value to the new anchor + range
// pair. `'note'` / `'dynamic'` followed the active note (→ note anchor);
// everything else anchored on today. The window size carries over where
// it existed; unknown / note references default to a day window.
function splitReference(ref: string): {
  anchor: TasksSidebarAnchor
  range: TasksSidebarRange
} {
  switch (ref) {
    case 'week':
      return { anchor: 'today', range: 'week' }
    case 'month':
      return { anchor: 'today', range: 'month' }
    case 'quarter':
      return { anchor: 'today', range: 'quarter' }
    case 'today':
      return { anchor: 'today', range: 'day' }
    case 'note':
    case 'dynamic':
      return { anchor: 'note', range: 'day' }
    default:
      return { anchor: 'note', range: 'day' }
  }
}

function isTaskFlow(value: unknown): value is TaskFlow {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Array.isArray((value as { statuses?: unknown }).statuses)
  )
}

// Generates a unique flow name within `flows`. If `base` is free,
// uses it as-is; otherwise appends an incrementing suffix until
// the name doesn't collide.
function uniqueName(
  base: string,
  flows: Record<string, unknown>
): string {
  if (!flows[base]) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base} ${i}`
    if (!flows[candidate]) return candidate
  }
  return `${base} ${Date.now()}`
}
