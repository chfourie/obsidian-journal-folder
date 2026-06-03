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

import { type App, Menu } from 'obsidian'
import type { TaskModel } from './task-models'
import { setTaskStatus, type TaskMutationTarget } from './task-transition'

// Builds the model's full set of statuses as menu items on the given
// `Menu`. The current status gets a leading check icon. Shared between
// the reading-view post-processor (which builds its own standalone
// menu) and the editor-menu integration (which adds items onto
// Obsidian's existing editor context menu).
export function appendStatusMenuItems(
  menu: Menu,
  target: TaskMutationTarget,
  model: TaskModel,
  app: App
): void {
  for (const status of model.statuses) {
    menu.addItem((item) => {
      item.setTitle(status.label)
      if (status.id === target.status) item.setIcon('check')
      item.onClick(() => {
        // noinspection JSIgnoredPromiseFromCall
        setTaskStatus(app, target, status.id, model)
      })
    })
  }
}

// Convenience for callers that want a standalone status menu opened
// at the given mouse event (reading-view path).
export function showStatusMenuAt(
  evt: MouseEvent,
  target: TaskMutationTarget,
  model: TaskModel,
  app: App
): void {
  const menu = new Menu()
  appendStatusMenuItems(menu, target, model, app)
  menu.showAtMouseEvent(evt)
}
