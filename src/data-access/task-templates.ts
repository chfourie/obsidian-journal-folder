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

import type { TaskStatus } from './task-model.type'

// Built-in flows that ship with the plugin. Each entry is the seed
// status array a template starts from; users can load any of these
// into `settings.taskStatuses` and then edit freely. Built-ins are
// read-only — "Save as…" copies the active flow under a user-named
// key in `settings.taskTemplates`.
//
// Every status here uses on-disk characters from the community-
// conventional checkbox alphabet (`[ ] [/] [x] [>] [-] [?] [d]`)
// so notes stay readable when opened with the Tasks plugin or
// rendered under common themes (Minimal, Things, AnuPpuccin, …).

// ---- shared visual helpers --------------------------------------

const openShell: TaskStatus['shell'] = {
  shape: 'circle',
  background: undefined,
  border: {
    color: { kind: 'token', var: '--checkbox-border-color' },
    width: 1,
  },
}

const inProgressShell: TaskStatus['shell'] = {
  shape: 'circle',
  background: { kind: 'token', var: '--background-modifier-border' },
  border: {
    color: { kind: 'token', var: '--checkbox-border-color' },
    width: 1,
  },
}

const filledShell = (colorVar: string): TaskStatus['shell'] => ({
  shape: 'circle',
  background: { kind: 'token', var: colorVar },
  border: null,
})

const onAccentIcon = (name: string): TaskStatus['icon'] => ({
  source: { kind: 'lucide', name },
  color: { kind: 'token', var: '--text-on-accent' },
  inset: 0.7,
})

const bareIcon = (
  name: string,
  colorVar: string
): TaskStatus['icon'] => ({
  source: { kind: 'lucide', name },
  color: { kind: 'token', var: colorVar },
  inset: 1,
})

const emptyIcon: TaskStatus['icon'] = { source: { kind: 'none' } }

// ---- canonical status definitions -------------------------------
//
// Defined once and re-used across templates so the visuals stay
// consistent (e.g. "done" looks the same in Simple, Kanban, and
// Bullet Journal). The `next` field is filled in per-template
// because the cycle differs.

const openStatus = (next: string): TaskStatus => ({
  id: 'open',
  label: 'Open',
  char: ' ',
  isDone: false,
  next,
  rendering: 'plugin',
  shell: openShell,
  icon: emptyIcon,
})

const inProgressStatus = (next: string): TaskStatus => ({
  id: 'in-progress',
  label: 'In progress',
  char: '/',
  isDone: false,
  next,
  rendering: 'plugin',
  shell: inProgressShell,
  icon: emptyIcon,
})

const doneStatus = (next: string): TaskStatus => ({
  id: 'done',
  label: 'Done',
  char: 'x',
  isDone: true,
  next,
  rendering: 'plugin',
  shell: filledShell('--color-green'),
  icon: onAccentIcon('check'),
})

const migratedStatus = (next: string): TaskStatus => ({
  id: 'migrated',
  label: 'Migrated',
  char: '>',
  isDone: true,
  next,
  rendering: 'plugin',
  shell: { shape: 'none' },
  // `redo-2` reads as "moved on" more strongly than the small
  // `corner-up-right` chevron.
  icon: bareIcon('redo-2', '--color-blue'),
})

const cancelledStatus = (next: string): TaskStatus => ({
  id: 'cancelled',
  label: 'Cancelled',
  char: '-',
  isDone: true,
  next,
  rendering: 'plugin',
  shell: filledShell('--color-red'),
  icon: onAccentIcon('x'),
})

const delegatedStatus = (next: string): TaskStatus => ({
  id: 'delegated',
  label: 'Delegated',
  char: 'd',
  isDone: true,
  next,
  rendering: 'plugin',
  shell: { shape: 'none' },
  icon: bareIcon('user-round', '--color-purple'),
})

const waitingStatus = (next: string): TaskStatus => ({
  id: 'waiting',
  label: 'Waiting',
  char: '?',
  isDone: false,
  next,
  rendering: 'plugin',
  shell: filledShell('--color-orange'),
  icon: onAccentIcon('clock'),
})

// ---- templates ---------------------------------------------------

const SIMPLE: TaskStatus[] = [
  openStatus('done'),
  doneStatus('open'),
]

// Kanban — three-state pipeline. Linear cycle so left-click walks
// the lane: open → in-progress → done → open.
const KANBAN: TaskStatus[] = [
  openStatus('in-progress'),
  inProgressStatus('done'),
  doneStatus('open'),
]

// Bullet Journal — five statuses from the original BuJo system plus
// the user-requested "delegated" entry. Primary cycle stays on the
// three most-frequent transitions (open → in-progress → done →
// open); migrated, cancelled, delegated reset to open and are
// usually reached via the right-click status menu.
const BULLET_JOURNAL: TaskStatus[] = [
  openStatus('in-progress'),
  inProgressStatus('done'),
  doneStatus('open'),
  migratedStatus('open'),
  cancelledStatus('open'),
  delegatedStatus('open'),
]

// GTD-flavoured flow — inbox → next action → waiting on someone
// else → done. Uses `[?]` for waiting (broadly themed) and the same
// `[/]` "in progress" character as BuJo for "next action" so the
// alphabet stays interoperable.
const GTD: TaskStatus[] = [
  openStatus('in-progress'),
  inProgressStatus('waiting'),
  waitingStatus('done'),
  doneStatus('open'),
]

export type BuiltInTemplateId =
  | 'simple'
  | 'kanban'
  | 'bullet-journal'
  | 'gtd'

export const BUILTIN_TEMPLATES: Record<BuiltInTemplateId, TaskStatus[]> = {
  simple: SIMPLE,
  kanban: KANBAN,
  'bullet-journal': BULLET_JOURNAL,
  gtd: GTD,
}

export const BUILTIN_TEMPLATE_LABELS: Record<BuiltInTemplateId, string> = {
  simple: 'Simple',
  kanban: 'Kanban',
  'bullet-journal': 'Bullet Journal',
  gtd: 'GTD',
}

export const DEFAULT_TEMPLATE_ID: BuiltInTemplateId = 'simple'

export function isBuiltInTemplate(id: string): id is BuiltInTemplateId {
  return id in BUILTIN_TEMPLATES
}

// Returns a deep clone of a built-in template so callers can mutate
// freely (e.g. the per-status editor) without poisoning the shared
// reference.
export function cloneTemplate(statuses: TaskStatus[]): TaskStatus[] {
  return statuses.map((s) => ({
    ...s,
    rendering: s.rendering ?? 'plugin',
    shell: {
      ...s.shell,
      background: s.shell.background ? { ...s.shell.background } : undefined,
      border: s.shell.border
        ? { ...s.shell.border, color: { ...s.shell.border.color } }
        : s.shell.border,
    },
    icon: {
      ...s.icon,
      source: { ...s.icon.source },
      color: s.icon.color ? { ...s.icon.color } : undefined,
    },
  }))
}
