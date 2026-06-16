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

import type { JournalFolderSettings } from './journal-folder-settings.type'

// Classifies which settings fields require which invalidation when a save
// propagates through `useSettings`. Every settings write — including the
// sidebar's scope controls (anchor / range / folder / show-completed) —
// goes through the same pipeline, so an unconditional invalidation turns a
// "show completed" click into a full task-cache rebuild and a re-render of
// every open reading view. The features diff the incoming settings against
// their previous snapshot with these field classes and only invalidate
// what the change actually affects.
//
// Over-invalidating is merely slow; under-invalidating is a stale-render /
// stale-cache bug. The lists below therefore err inclusive, and the
// reading-view gate is an EXCLUSION list (`RENDER_INERT_FIELDS`) so any
// future field defaults to "re-render".

type SettingsField = keyof JournalFolderSettings

// Fields baked into cached `JournalTask` entries by `extractTasks` — when
// one changes, `TaskCache.clear()` is required because the cache's
// mtime/model-id validation cannot see it:
// - the active model (flow dictionary + which flow resolves): parsed
//   status ids are model-specific (edits *within* a flow keep the model id,
//   so the cache's own model-id check is not enough),
// - migration markers: stripped from each task's display text at parse,
// - signifiers / categories: matched + stripped at parse
//   (`signifierIds` / `categoryIds`),
// - title patterns / start-of-week / quarters: cached tasks bake the
//   rendered source-note titles (`noteTitle`, `noteTitleShort`) and the
//   note's tier at parse time.
export const TASK_PARSE_FIELDS = [
  'taskFlows',
  'defaultTaskFlow',
  'taskFlow',
  'taskMigrationToMarker',
  'taskMigrationFromMarker',
  'signifiers',
  'taskCategories',
  'quartersEnabled',
  'startOfWeek',
  'dailyNoteTitlePattern',
  'dailyNoteShortTitlePattern',
  'dailyNoteMediumTitlePattern',
  'weeklyNoteTitlePattern',
  'weeklyNoteShortTitlePattern',
  'weeklyNoteMediumTitlePattern',
  'monthlyNoteTitlePattern',
  'monthlyNoteShortTitlePattern',
  'monthlyNoteMediumTitlePattern',
  'quarterlyNoteTitlePattern',
  'quarterlyNoteShortTitlePattern',
  'quarterlyNoteMediumTitlePattern',
  'yearlyNoteTitlePattern',
  'yearlyNoteShortTitlePattern',
  'yearlyNoteMediumTitlePattern',
] as const satisfies ReadonlyArray<SettingsField>

// Fields the tasks feature's CodeMirror surfaces render from (the
// document-task live-preview extension and the migration-reference
// live-preview extension). A change here needs
// `workspace.updateOptions()` so open editors re-run their ViewPlugins
// without waiting for the user to type.
export const TASK_EDITOR_FIELDS = [
  'taskInteractionScope',
  'taskClickOpensPicker',
  'taskFlows',
  'defaultTaskFlow',
  'taskFlow',
  'taskMigrationToMarker',
  'taskMigrationFromMarker',
  'taskMigrationReferenceOpacity',
] as const satisfies ReadonlyArray<SettingsField>

// Fields the signifier surfaces render from (reading-view post-processor,
// gutter positioner / reserve, and the signifier live-preview extension).
export const SIGNIFIER_RENDER_FIELDS = [
  'signifiers',
  'signifierPlacement',
  'signifierReserveGutter',
  'signifierHideTagInReadingView',
  'signifierHideTagInLivePreview',
  'signifierShowTagsOnActiveLine',
] as const satisfies ReadonlyArray<SettingsField>

// Fields that can never change what an open reading view renders — pure
// UI state (the sidebar panels' own controls), behaviour-of-future-writes
// settings (migration placement / heading / reference toggles; the style
// only reseeds the markers, which are render-relevant themselves), and
// migration bookkeeping (the legacy inline-template fields are no longer
// read by any render path). Everything NOT listed here is treated as
// render-relevant, so a newly added field fails safe (extra re-render,
// never a stale view).
export const RENDER_INERT_FIELDS = [
  'sidebarMode',
  'defaultJournalFolder',
  'todayButtonPlacement',
  'includeInTodayPicker',
  'hideJournalFolderNotes',
  'editModeIndicator',
  'tasksSidebarEnabled',
  'tasksSidebarAnchor',
  'tasksSidebarRange',
  'tasksSidebarFolderMode',
  'tasksSidebarFolder',
  'tasksShowCompleted',
  'tasksOnlySidebarAnchor',
  'tasksOnlySidebarRange',
  'tasksOnlySidebarFolderMode',
  'tasksOnlySidebarFolder',
  'tasksOnlySidebarShowCompleted',
  'taskMigrationPlacement',
  'taskMigrationHeading',
  'taskMigrationAddToReference',
  'taskMigrationAddFromReference',
  'taskMigrationReferenceStyle',
  'templatesMigratedToFiles',
  'autoTemplateContent',
  'autoTemplatePerTier',
  'dailyNoteAutoTemplateContent',
  'weeklyNoteAutoTemplateContent',
  'monthlyNoteAutoTemplateContent',
  'quarterlyNoteAutoTemplateContent',
  'yearlyNoteAutoTemplateContent',
] as const satisfies ReadonlyArray<SettingsField>

// Per-field value equality. Structured fields (flows, signifiers,
// categories) are compared by JSON value, not reference — the settings
// object is rebuilt wholesale on load / external sync, so reference
// identity would report false changes there. A key-order difference can
// still report a false change, which only costs an extra invalidation.
function fieldEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

// True when any of `fields` differs by value between the two snapshots.
export function settingsFieldsChanged(
  prev: JournalFolderSettings,
  next: JournalFolderSettings,
  fields: ReadonlyArray<SettingsField>
): boolean {
  return fields.some((field) => !fieldEquals(prev[field], next[field]))
}

// True when the change can affect what an open reading view renders —
// i.e. any field OUTSIDE `RENDER_INERT_FIELDS` changed. Gates the
// `previewMode.rerender(true)` sweep over open markdown leaves, which
// serves every reading-view surface (signifiers, migration references,
// document checkboxes, `journal-header` / `journal-tasks` blocks).
export function readingViewRenderAffected(
  prev: JournalFolderSettings,
  next: JournalFolderSettings
): boolean {
  const inert = new Set<SettingsField>(RENDER_INERT_FIELDS)
  const fields = new Set([
    ...Object.keys(prev),
    ...Object.keys(next),
  ]) as Set<SettingsField>
  for (const field of fields) {
    if (inert.has(field)) continue
    if (!fieldEquals(prev[field], next[field])) return true
  }
  return false
}
