<!--
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
-->
<script lang="ts">
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import type { JournalTask } from '../../data-access'
  import type { TaskModel } from './task-models'

  type Props = {
    tasks: JournalTask[]
    model: TaskModel
    // Heading shown above the list, e.g. "Migrate to 2026-06-05".
    heading: string
    onConfirm: (selected: JournalTask[]) => void
    onCancel: () => void
  }

  const { tasks, model, heading, onConfirm, onCancel }: Props = $props()

  const keyOf = (t: JournalTask) => `${t.sourceFile.path}:${t.sourceLine}`

  // Default to everything selected — the common case is "migrate all of
  // these forward"; deselecting a few is cheaper than ticking many. The
  // task list is fixed for a modal instance, so seed once (untrack keeps
  // this an intentional non-reactive read).
  const selected = new SvelteSet<string>(untrack(() => tasks).map(keyOf))

  type Group = { path: string; title: string; tasks: JournalTask[] }
  // Group by note path via a Map (NOT consecutive-run grouping): the
  // "to this note" flow gathers tasks across many same-tier notes, which
  // `sortTasks` interleaves (it tie-breaks by folder + line, not file),
  // so the same path can appear non-adjacently. A Map keeps one group
  // per path — first-seen order — and avoids duplicate `{#each}` keys.
  const groups = $derived.by(() => {
    const byPath = new Map<string, Group>()
    for (const task of tasks) {
      let group = byPath.get(task.sourceFile.path)
      if (!group) {
        group = { path: task.sourceFile.path, title: task.noteTitle, tasks: [] }
        byPath.set(group.path, group)
      }
      group.tasks.push(task)
    }
    return [...byPath.values()]
  })

  const selectedCount = $derived(selected.size)

  function statusChar(t: JournalTask): string {
    return model.statuses.find((s) => s.id === t.status)?.char ?? ' '
  }

  function isSelected(t: JournalTask): boolean {
    return selected.has(keyOf(t))
  }

  function toggleTask(t: JournalTask) {
    const k = keyOf(t)
    if (selected.has(k)) selected.delete(k)
    else selected.add(k)
  }

  function groupState(group: Group): 'all' | 'none' | 'some' {
    const n = group.tasks.filter(isSelected).length
    if (n === 0) return 'none'
    if (n === group.tasks.length) return 'all'
    return 'some'
  }

  function toggleGroup(group: Group) {
    const allOn = groupState(group) === 'all'
    for (const t of group.tasks) {
      const k = keyOf(t)
      if (allOn) selected.delete(k)
      else selected.add(k)
    }
  }

  function confirm() {
    const picked = tasks.filter((t) => selected.has(keyOf(t)))
    onConfirm(picked)
  }
</script>

<div class="jf-migrate-picker">
  <div class="jf-migrate-picker-heading">{heading}</div>

  {#if tasks.length === 0}
    <p class="journal-folder-tasks-empty">No active tasks available to migrate.</p>
  {:else}
    <div class="jf-migrate-picker-list">
      {#each groups as group (group.path)}
        {@const state = groupState(group)}
        <div class="jf-migrate-picker-group">
          <label class="jf-migrate-picker-group-heading">
            <input
              type="checkbox"
              checked={state === 'all'}
              indeterminate={state === 'some'}
              onchange={() => toggleGroup(group)}
            />
            <span class="jf-migrate-picker-group-title">{group.title}</span>
            <span class="jf-migrate-picker-group-count">({group.tasks.length})</span>
          </label>
          <div class="jf-migrate-picker-tasks">
            {#each group.tasks as task (keyOf(task))}
              <label class="jf-migrate-picker-task">
                <input
                  type="checkbox"
                  checked={isSelected(task)}
                  onchange={() => toggleTask(task)}
                />
                <span class="jf-migrate-picker-task-char">[{statusChar(task)}]</span>
                <span class="jf-migrate-picker-task-text">{task.displayText}</span>
              </label>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="modal-button-container jf-migrate-picker-actions">
    <button type="button" onclick={onCancel}>Cancel</button>
    <button
      type="button"
      class="mod-cta"
      disabled={selectedCount === 0}
      onclick={confirm}
    >
      Migrate ({selectedCount})
    </button>
  </div>
</div>
