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

import type { Plugin } from 'obsidian'
import { PluginFeature } from '../../data-access'
import { startNewLineBelow } from './start-new-line'

/**
 * Small editor-command feature. Registers a command that starts a new line
 * below the cursor's line — equivalent to pressing Enter at the end of the
 * current line — so the user can begin a fresh entry (continuing a bullet /
 * checkbox / blockquote) without first moving to the line's end. The command
 * carries no default hotkey; bind it (e.g. to Ctrl/Cmd+Enter) in Obsidian's
 * Hotkeys settings, the same as the plugin's other shortcuts.
 */
export class JournalEditorFeature extends PluginFeature {
  constructor(plugin: Plugin) {
    super(plugin)
  }

  async load(): Promise<void> {
    this.plugin.addCommand({
      id: 'start-new-line-below',
      name: 'Start a new line below',
      editorCallback: (editor) => startNewLineBelow(editor),
    })
  }
}
