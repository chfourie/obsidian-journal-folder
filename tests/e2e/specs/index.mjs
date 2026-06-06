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

// Ordered list of e2e suites. Add a spec by importing its `suite` here.

import { suite as smoke } from './smoke.spec.mjs'
import { suite as headerNav } from './header-nav.spec.mjs'
import { suite as calendar } from './calendar.spec.mjs'
import { suite as tasksRender } from './tasks-render.spec.mjs'
import { suite as taskStatus } from './task-status.spec.mjs'
import { suite as taskMigration } from './task-migration.spec.mjs'
import { suite as tasksScope } from './tasks-scope.spec.mjs'
import { suite as signifiers } from './signifiers.spec.mjs'
import { suite as autoTemplate } from './auto-template.spec.mjs'
import { suite as templatePreview } from './template-preview.spec.mjs'
import { suite as settings } from './settings.spec.mjs'
import { suite as settingsConfig } from './settings-config.spec.mjs'
import { suite as sidebar } from './sidebar.spec.mjs'
import { suite as folderConfig } from './folder-config.spec.mjs'
import { suite as ribbonTheme } from './ribbon-theme.spec.mjs'

export const suites = [
  smoke,
  headerNav,
  calendar,
  tasksRender,
  taskStatus,
  taskMigration,
  tasksScope,
  signifiers,
  autoTemplate,
  templatePreview,
  settings,
  settingsConfig,
  sidebar,
  folderConfig,
  ribbonTheme,
]
