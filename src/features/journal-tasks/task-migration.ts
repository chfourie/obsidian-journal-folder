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

import { type App, Notice, type TFile } from 'obsidian'
import type {
  TaskFlow,
  TaskMigrationPlacement,
  TaskStatus,
  TaskStatusId,
} from '../../data-access'
import type { TaskModel } from './task-models'
import { TASK_LINE_REGEX } from './task-models/task-line-regex'

// The minimal shape the migration writer needs to relocate a task. A
// full `JournalTask` satisfies it; the editor-menu single-task path can
// also build one straight from a cursor line.
export interface MigratableTask {
  sourceFile: TFile
  sourceLine: number
  rawText: string
  status: TaskStatusId
}

// Builds the `MigratableTask` for a single line, or null when the line
// is not an *active* (non-done) task the model recognises. Shared by the
// editor-menu item and the keyboard command so both agree on exactly
// which lines can be migrated. Lives here (not in the menu module) so it
// stays free of the menu's Svelte-modal imports and remains unit-testable.
export function migratableTaskOnLine(
  model: TaskModel,
  file: TFile,
  lineNumber: number,
  lineText: string
): MigratableTask | null {
  const parsed = model.parseLine(lineText)
  if (!parsed || model.isDone(parsed.status)) return null
  return {
    sourceFile: file,
    sourceLine: lineNumber,
    rawText: lineText,
    status: parsed.status,
  }
}

// The three migration flows the unified command can offer.
export type MigrationActionKind = 'line' | 'from' | 'to'

// Decides which migration flows make sense in the current context, in
// the order they should be offered: migrate the cursor-line task (only
// when the line *is* an active task), migrate tasks *from* this note
// (only when the note has active tasks), and migrate tasks *to* this
// note (always — `runToNoteFlow` reports an empty folder itself). Pure
// so the conditional logic is unit-testable without a modal.
export function availableMigrationActions(opts: {
  hasLineTask: boolean
  activeOnPageCount: number
}): MigrationActionKind[] {
  const kinds: MigrationActionKind[] = []
  if (opts.hasLineTask) kinds.push('line')
  if (opts.activeOnPageCount > 0) kinds.push('from')
  kinds.push('to')
  return kinds
}

// The flow's inactive statuses — the only valid candidates for a
// migrated-status designation (migration closes the origin out). Drives
// both the flow-editor picker and the Active-toggle guard.
export function eligibleMigratedStatuses(flow: TaskFlow): TaskStatus[] {
  return flow.statuses.filter((s) => s.isDone)
}

// Formats a cross-reference: an optional marker followed by a wikilink
// to `basename`. An empty / whitespace marker yields the bare link.
export function formatReference(marker: string, basename: string): string {
  const link = `[[${basename}]]`
  const trimmed = marker.trim()
  return trimmed ? `${trimmed} ${link}` : link
}

// Builds the destination line for a migrated task: a fresh **top-level**
// bullet that preserves the origin's current (active) status. When
// `addReference` is true a back-reference to the origin note is appended
// (`fromMarker [[origin]]`); when false the copy carries no link. Sub-
// bullets and the origin's indentation are intentionally dropped in v1.
// Falls back to the flow's first status if the origin status no longer
// exists in the destination model (a folder whose flow changed
// mid-stream).
export function buildMigratedLine(
  task: MigratableTask,
  model: TaskModel,
  fromMarker = '',
  addReference = true
): string {
  const parsed = model.parseLine(task.rawText)
  const body = parsed ? parsed.text : task.rawText.trim()
  const statusId = model.statuses.some((s) => s.id === task.status)
    ? task.status
    : (model.statuses[0]?.id ?? task.status)
  const line = `- ${model.serializeStatus(statusId)} ${body}`
  if (!addReference) return line
  return `${line} ${formatReference(fromMarker, task.sourceFile.basename)}`
}

// Re-stamps the origin line to the flow's migrated status and, when
// `addReference` is true, appends a forward link to the destination note
// (`toMarker [[dest]]`). Returns `null` when the line no longer parses as
// a task with the expected status — the caller's cache is stale and the
// write should be skipped (matching the line-match guard
// `task-transition.ts` uses). Idempotent on the link: a line that
// already points at `destBasename` isn't double-linked.
export function transformOriginLine(
  line: string,
  task: MigratableTask,
  model: TaskModel,
  destBasename: string,
  toMarker = '',
  addReference = true
): string | null {
  if (model.migratedStatusId === null) return null
  const parsed = model.parseLine(line)
  if (!parsed || parsed.status !== task.status) return null
  const next = line.replace(
    /\[(.)\]/,
    model.serializeStatus(model.migratedStatusId)
  )
  if (!addReference || next.includes(`[[${destBasename}]]`)) return next
  return `${next.replace(/\s+$/, '')} ${formatReference(toMarker, destBasename)}`
}

// ---------------- placement engine (pure) ------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Index of the line *after* the last non-blank line — where end-of-note
// content should be appended while preserving a single trailing newline.
function endOfContentIndex(lines: string[]): number {
  let i = lines.length
  while (i > 0 && lines[i - 1].trim() === '') i--
  return i
}

// Index of the first body line (after a leading `---`…`---` front-matter
// block, if any).
function afterFrontMatterIndex(lines: string[]): number {
  if (lines[0] !== '---') return 0
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return i + 1
  }
  return 0
}

// Coerce a (possibly front-matter-sourced) heading level into a valid
// Markdown heading depth. Anything non-numeric or out of range falls
// back to 2 — the historical default before the level was configurable.
function clampHeadingLevel(level: number): number {
  const n = Math.floor(Number(level))
  if (!Number.isFinite(n)) return 2
  return Math.min(6, Math.max(1, n))
}

// Pure placement engine: returns `content` with `newLines` inserted
// according to `placement`. Operates on a line array so an existing
// trailing newline is preserved (a trailing newline splits to a final
// empty element that re-joins identically).
export function computeInsertion(
  content: string,
  newLines: string[],
  placement: TaskMigrationPlacement,
  headingText: string,
  headingLevel = 2
): string {
  if (newLines.length === 0) return content
  const lines = content.split('\n')

  if (placement === 'top') {
    lines.splice(afterFrontMatterIndex(lines), 0, ...newLines)
    return lines.join('\n')
  }

  if (placement === 'after-last-task') {
    let lastTask = -1
    for (let i = 0; i < lines.length; i++) {
      if (TASK_LINE_REGEX.test(lines[i])) lastTask = i
    }
    const at = lastTask >= 0 ? lastTask + 1 : endOfContentIndex(lines)
    lines.splice(at, 0, ...newLines)
    return lines.join('\n')
  }

  if (placement === 'heading') {
    const heading = headingText.trim()
    const headingRe = new RegExp(
      `^#{1,6}\\s+${escapeRegExp(heading)}\\s*$`,
      'i'
    )
    const at = lines.findIndex((l) => headingRe.test(l))
    if (at >= 0) {
      lines.splice(at + 1, 0, ...newLines)
      return lines.join('\n')
    }
    // No such heading — create it at the configured level at the end,
    // separated from any preceding content by a blank line.
    const hashes = '#'.repeat(clampHeadingLevel(headingLevel))
    const end = endOfContentIndex(lines)
    const block =
      end > 0
        ? ['', `${hashes} ${heading}`, ...newLines]
        : [`${hashes} ${heading}`, ...newLines]
    lines.splice(end, 0, ...block)
    return lines.join('\n')
  }

  // 'end'
  lines.splice(endOfContentIndex(lines), 0, ...newLines)
  return lines.join('\n')
}

// ---------------- orchestrator ----------------------------------

const STALE_MESSAGE =
  'Some tasks moved since they were listed — those were skipped. Try again.'

export interface MigrateTasksInput {
  app: App
  destFile: TFile
  // Active tasks to relocate. The caller resolves eligibility; the
  // writer additionally skips any whose origin line has drifted.
  tasks: MigratableTask[]
  // Model + placement resolved from the **destination folder's**
  // settings (single-folder migration ⇒ origin and dest share a flow).
  model: TaskModel
  placement: TaskMigrationPlacement
  headingText: string
  // Heading level used when `placement` is `'heading'` and the heading
  // must be created (1–6; defaults to 2 when omitted).
  headingLevel?: number
  // Cross-reference markers (global-only settings). `toMarker` prefixes
  // the forward link on the origin; `fromMarker` prefixes the back link
  // on the copy. The `add*Reference` flags omit a reference entirely.
  toMarker: string
  fromMarker: string
  addToReference: boolean
  addFromReference: boolean
}

// Relocates `tasks` into `destFile`: writes fresh copies per the
// placement setting, then stamps each origin with the migrated status
// plus a `→ [[dest]]` forward link. Aborts (with a Notice) when the
// destination flow has no migrated status configured. Origin writes use
// a per-line guard — a drifted line is skipped, not blind-written.
export async function migrateTasks(input: MigrateTasksInput): Promise<void> {
  const {
    app,
    destFile,
    model,
    placement,
    headingText,
    headingLevel,
    toMarker,
    fromMarker,
    addToReference,
    addFromReference,
  } = input
  const tasks = input.tasks.filter((t) => !model.isDone(t.status))

  if (model.migratedStatusId === null) {
    new Notice(
      'This flow has no migrated status configured. Set one on the ' +
        'flow in plugin settings (Tasks → the flow → Migrated status).'
    )
    return
  }
  if (tasks.length === 0) {
    new Notice('No active tasks to migrate.')
    return
  }
  // The pickers already exclude the source note from the target list, but
  // guard here too — migrating a task into its own note would stamp the
  // origin line and then append an active duplicate to the same note.
  if (tasks.some((t) => t.sourceFile.path === destFile.path)) {
    new Notice('Tasks cannot be migrated into the note they are already in.')
    return
  }

  // 1) Stamp the origins first, grouped by file so each note is
  //    processed once. Only tasks whose origin line still matches are
  //    counted as migrated — a drifted line is skipped here so we don't
  //    copy it to the destination in step 2 (which would duplicate a
  //    task we couldn't close out at the source).
  const byFile = new Map<string, MigratableTask[]>()
  for (const task of tasks) {
    const list = byFile.get(task.sourceFile.path) ?? []
    list.push(task)
    byFile.set(task.sourceFile.path, list)
  }

  const migrated: MigratableTask[] = []
  let skipped = 0
  for (const list of byFile.values()) {
    const file = list[0].sourceFile
    await app.vault.process(file, (content) => {
      const lines = content.split('\n')
      for (const task of list) {
        const line = lines[task.sourceLine]
        const updated =
          line === undefined
            ? null
            : transformOriginLine(
                line,
                task,
                model,
                destFile.basename,
                toMarker,
                addToReference
              )
        if (updated === null) {
          skipped++
          continue
        }
        lines[task.sourceLine] = updated
        migrated.push(task)
      }
      return lines.join('\n')
    })
  }

  // 2) Write copies for the tasks that were actually stamped.
  if (migrated.length > 0) {
    const newLines = migrated.map((t) =>
      buildMigratedLine(t, model, fromMarker, addFromReference)
    )
    await app.vault.process(destFile, (content) =>
      computeInsertion(content, newLines, placement, headingText, headingLevel)
    )
    new Notice(
      `Migrated ${migrated.length} task${migrated.length === 1 ? '' : 's'} → ${destFile.basename}`
    )
  }
  if (skipped > 0) new Notice(STALE_MESSAGE)
}
