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
  import { type App, Menu } from 'obsidian'
  import type { JournalTask } from '../../data-access'
  import type { TaskModel } from './task-models'
  import StatusIcon from './StatusIcon.svelte'
  import { cycleTaskStatus, setTaskStatus } from './task-transition'

  type Props = {
    task: JournalTask
    model: TaskModel
    app: App
  }

  const { task, model, app }: Props = $props()

  const statusEntry = $derived(model.statuses.find((s) => s.id === task.status))
  const isDone = $derived(model.isDone(task.status))
  const statusChar = $derived(statusEntry?.char ?? ' ')
  const rendering = $derived(statusEntry?.rendering ?? 'plugin')

  function openSourceLine() {
    app.workspace.openLinkText(task.sourceFile.path, '', false)
  }

  function onIconClick(evt: MouseEvent) {
    evt.stopPropagation()
    // noinspection JSIgnoredPromiseFromCall
    cycleTaskStatus(app, task, model)
  }

  function onIconContextMenu(evt: MouseEvent) {
    const menu = new Menu()
    for (const status of model.statuses) {
      menu.addItem((item) => {
        item.setTitle(status.label)
        if (status.id === task.status) item.setIcon('check')
        item.onClick(() => {
          // noinspection JSIgnoredPromiseFromCall
          setTaskStatus(app, task, status.id, model)
        })
      })
    }
    menu.showAtMouseEvent(evt)
  }

  const titleAttr = $derived(
    `${task.rawText}\n${task.sourceFile.path}:${task.sourceLine + 1}`
  )
</script>

<div
  class="journal-folder-tasks-row"
  class:journal-folder-tasks-done={isDone}
  class:task-list-item={rendering === 'theme'}
  data-task={rendering === 'theme' ? statusChar : undefined}
  title={titleAttr}
>
  <StatusIcon
    status={task.status}
    model={model}
    onClick={onIconClick}
    onContextMenu={onIconContextMenu}
  />
  <span
    class="journal-folder-tasks-text"
    role="button"
    tabindex="0"
    onclick={openSourceLine}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openSourceLine()
      }
    }}
  >
    {task.displayText}
  </span>
</div>
