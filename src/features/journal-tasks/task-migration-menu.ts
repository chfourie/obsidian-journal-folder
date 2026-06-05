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

import { type App, type Editor, type Menu, Notice, type TFile } from 'obsidian'
import {
  isJournalFileBasename,
  isJournalFolder,
  type JournalFolderSettings,
  type JournalTask,
  journalNoteFactoryWithSettings,
} from '../../data-access'
import type { TaskCache } from './task-cache'
import { resolveTaskModel, type TaskModel } from './task-models'
import {
  effectiveUnits,
  findTaskCandidates,
  listJournalNotesInFolder,
} from './task-scope'
import { allTimeRange } from './reference-range'
import { sortTasks } from './task-sorting'
import {
  availableMigrationActions,
  migrateTasks,
  migratableTaskOnLine,
  type MigratableTask,
} from './task-migration'
import { MigrationPickerModal } from './migration-picker-modal'
import { MigrationTargetModal } from './migration-target-modal'
import {
  type MigrationAction,
  MigrationActionModal,
} from './migration-action-modal'

// Everything the migration flows need from the host feature. `getSettingsFor`
// resolves folder-level settings (front matter overlaid on global), so a
// folder's `task-flow` / `task-migration-*` overrides are honoured.
export interface MigrationMenuContext {
  app: App
  cache: TaskCache
  getSettingsFor: (file: TFile | null) => JournalFolderSettings
}

interface ResolvedNote {
  folderPath: string
  settings: JournalFolderSettings
  model: TaskModel
}

// A note is migration-capable when it lives in a journal folder, has a
// journal basename, and its resolved flow declares a (valid, inactive)
// migrated status. Returns null otherwise so callers can bail without
// adding menu items.
function resolveNote(
  ctx: MigrationMenuContext,
  file: TFile
): ResolvedNote | null {
  const folderPath = file.parent?.path ?? ''
  if (!isJournalFolder(ctx.app, folderPath)) return null
  const settings = ctx.getSettingsFor(file)
  if (!isJournalFileBasename(file.basename, !!settings.quartersEnabled)) {
    return null
  }
  const model = resolveTaskModel(settings)
  if (model.migratedStatusId === null) return null
  return { folderPath, settings, model }
}

async function gatherNoteActiveTasks(
  ctx: MigrationMenuContext,
  file: TFile,
  settings: JournalFolderSettings,
  model: TaskModel
): Promise<JournalTask[]> {
  const factory = journalNoteFactoryWithSettings(settings)
  let note
  try {
    note = factory(file)
  } catch {
    return []
  }
  const tasks = await ctx.cache.getTasks(file, model, note)
  return tasks.filter((t) => !model.isDone(t.status))
}

async function gatherFolderActiveTasks(
  ctx: MigrationMenuContext,
  folderPath: string,
  settings: JournalFolderSettings,
  model: TaskModel,
  excludePath: string
): Promise<JournalTask[]> {
  const candidates = findTaskCandidates({
    app: ctx.app,
    folders: [folderPath],
    units: effectiveUnits(settings),
    referenceRange: allTimeRange(),
    settings,
  })
  const out: JournalTask[] = []
  for (const candidate of candidates) {
    if (candidate.file.path === excludePath) continue
    const tasks = await ctx.cache.getTasks(candidate.file, model, candidate.note)
    out.push(...tasks.filter((t) => !model.isDone(t.status)))
  }
  return sortTasks(out)
}

// Resolves the destination note's own model + placement (it shares the
// folder, so the model matches the source) and runs the writer.
function migrateInto(
  ctx: MigrationMenuContext,
  destFile: TFile,
  tasks: MigratableTask[]
): void {
  const settings = ctx.getSettingsFor(destFile)
  const model = resolveTaskModel(settings)
  // noinspection JSIgnoredPromiseFromCall
  migrateTasks({
    app: ctx.app,
    destFile,
    tasks,
    model,
    placement: settings.taskMigrationPlacement,
    headingText: settings.taskMigrationHeading,
    toMarker: settings.taskMigrationToMarker,
    fromMarker: settings.taskMigrationFromMarker,
    addToReference: settings.taskMigrationAddToReference,
    addFromReference: settings.taskMigrationAddFromReference,
  })
}

function pickTargetThenMigrate(
  ctx: MigrationMenuContext,
  resolved: ResolvedNote,
  sourceFile: TFile,
  tasks: MigratableTask[]
): void {
  const candidates = listJournalNotesInFolder({
    app: ctx.app,
    folderPath: resolved.folderPath,
    settings: resolved.settings,
    excludePath: sourceFile.path,
  })
  if (candidates.length === 0) {
    new Notice('No other journal notes in this folder to migrate into.')
    return
  }
  new MigrationTargetModal(ctx.app, candidates, (destFile) =>
    migrateInto(ctx, destFile, tasks)
  ).open()
}

// ---------------- flows -----------------------------------------

async function runFromNoteFlow(
  ctx: MigrationMenuContext,
  file: TFile,
  resolved: ResolvedNote
): Promise<void> {
  const active = await gatherNoteActiveTasks(
    ctx,
    file,
    resolved.settings,
    resolved.model
  )
  if (active.length === 0) {
    new Notice('No active tasks in this note to migrate.')
    return
  }
  new MigrationPickerModal(ctx.app, {
    tasks: active,
    model: resolved.model,
    heading: `Migrate from ${file.basename}`,
    title: 'Migrate tasks from note',
    onConfirm: (selected) =>
      pickTargetThenMigrate(ctx, resolved, file, selected),
  }).open()
}

async function runToNoteFlow(
  ctx: MigrationMenuContext,
  file: TFile,
  resolved: ResolvedNote
): Promise<void> {
  const active = await gatherFolderActiveTasks(
    ctx,
    resolved.folderPath,
    resolved.settings,
    resolved.model,
    file.path
  )
  if (active.length === 0) {
    new Notice('No active tasks in this folder to migrate here.')
    return
  }
  new MigrationPickerModal(ctx.app, {
    tasks: active,
    model: resolved.model,
    heading: `Migrate into ${file.basename}`,
    title: 'Migrate tasks to note',
    onConfirm: (selected) => migrateInto(ctx, file, selected),
  }).open()
}

// ---------------- menu entry points -----------------------------

// File-menu (right-click a note): the two whole-note flows.
export function appendNoteMigrationItems(
  menu: Menu,
  ctx: MigrationMenuContext,
  file: TFile
): void {
  const resolved = resolveNote(ctx, file)
  if (!resolved) return
  menu.addItem((item) => {
    item
      .setTitle('Migrate tasks from this note…')
      .setIcon('arrow-right-from-line')
      .onClick(() => {
        // noinspection JSIgnoredPromiseFromCall
        runFromNoteFlow(ctx, file, resolved)
      })
  })
  menu.addItem((item) => {
    item
      .setTitle('Migrate tasks to this note…')
      .setIcon('arrow-right-to-line')
      .onClick(() => {
        // noinspection JSIgnoredPromiseFromCall
        runToNoteFlow(ctx, file, resolved)
      })
  })
}

// Editor-menu (right-click a task line): migrate that single task.
export function appendEditorMigrationItem(
  menu: Menu,
  ctx: MigrationMenuContext,
  file: TFile,
  editor: Editor
): void {
  const resolved = resolveNote(ctx, file)
  if (!resolved) return
  const cursor = editor.getCursor()
  const task = migratableTaskOnLine(
    resolved.model,
    file,
    cursor.line,
    editor.getLine(cursor.line)
  )
  if (!task) return
  menu.addItem((item) => {
    item
      .setTitle('Migrate task…')
      .setIcon('arrow-right-from-line')
      .onClick(() => pickTargetThenMigrate(ctx, resolved, file, [task]))
  })
}

// Shown by the keyboard commands when the active note can't host a
// migration (not a journal note, not in a journal folder, or its flow
// declares no migrated status). The menu entry points stay silent in
// the same situation — they just omit themselves.
const UNAVAILABLE_MESSAGE =
  'Task migration is unavailable here — open a journal note whose ' +
  'flow defines a migrated status.'

// Keyboard-command entry point: migrate the task on the cursor line.
// Unlike the menu item (which silently omits itself when unavailable),
// a hotkey press wants feedback, so each bail path emits a Notice.
export function migrateTaskOnLine(
  ctx: MigrationMenuContext,
  file: TFile,
  editor: Editor
): void {
  const resolved = resolveNote(ctx, file)
  if (!resolved) {
    new Notice(UNAVAILABLE_MESSAGE)
    return
  }
  const cursor = editor.getCursor()
  const task = migratableTaskOnLine(
    resolved.model,
    file,
    cursor.line,
    editor.getLine(cursor.line)
  )
  if (!task) {
    new Notice('No active task on the current line to migrate.')
    return
  }
  pickTargetThenMigrate(ctx, resolved, file, [task])
}

// Keyboard-command entry point: open the "migrate tasks from this note"
// picker for the given file (the same flow as the file-menu item).
export async function migrateTasksFromNote(
  ctx: MigrationMenuContext,
  file: TFile
): Promise<void> {
  const resolved = resolveNote(ctx, file)
  if (!resolved) {
    new Notice(UNAVAILABLE_MESSAGE)
    return
  }
  await runFromNoteFlow(ctx, file, resolved)
}

// Keyboard-command entry point: open the "migrate tasks to this note"
// picker for the given file (the same flow as the file-menu item).
export async function migrateTasksToNote(
  ctx: MigrationMenuContext,
  file: TFile
): Promise<void> {
  const resolved = resolveNote(ctx, file)
  if (!resolved) {
    new Notice(UNAVAILABLE_MESSAGE)
    return
  }
  await runToNoteFlow(ctx, file, resolved)
}

// Unified keyboard-command entry point: open a chooser of the migration
// flows that apply right now, then run the picked one. The cursor-line
// option appears only on an active task line; the "from this note"
// option only when the note has active tasks; "to this note" always.
export async function migrateInteractive(
  ctx: MigrationMenuContext,
  file: TFile,
  editor: Editor
): Promise<void> {
  const resolved = resolveNote(ctx, file)
  if (!resolved) {
    new Notice(UNAVAILABLE_MESSAGE)
    return
  }

  const cursor = editor.getCursor()
  const lineTask = migratableTaskOnLine(
    resolved.model,
    file,
    cursor.line,
    editor.getLine(cursor.line)
  )
  const active = await gatherNoteActiveTasks(
    ctx,
    file,
    resolved.settings,
    resolved.model
  )

  const kinds = availableMigrationActions({
    hasLineTask: lineTask !== null,
    activeOnPageCount: active.length,
  })

  const builders: Record<(typeof kinds)[number], () => MigrationAction> = {
    line: () => ({
      title: 'Migrate the task on the current line',
      // `lineTask` is non-null whenever the `line` kind is offered.
      run: () => pickTargetThenMigrate(ctx, resolved, file, [lineTask!]),
    }),
    from: () => ({
      title: `Migrate tasks from this note (${active.length} active)`,
      run: () => {
        // noinspection JSIgnoredPromiseFromCall
        runFromNoteFlow(ctx, file, resolved)
      },
    }),
    to: () => ({
      title: 'Migrate tasks to this note',
      run: () => {
        // noinspection JSIgnoredPromiseFromCall
        runToNoteFlow(ctx, file, resolved)
      },
    }),
  }

  new MigrationActionModal(
    ctx.app,
    kinds.map((kind) => builders[kind]())
  ).open()
}
