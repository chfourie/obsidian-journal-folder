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

import { mount } from 'svelte'
import {
  type JournalFolderSettings,
  JournalNote,
  journalNoteFactoryWithSettings,
  PluginFeature,
} from 'src/data-access'
import { ErrorMessage } from 'src/ui'
import JournalHeader from './JournalHeader.svelte'
import {
  buildJournalHeaderInfo,
  type JournalHeaderInfo,
} from './journal-header-info'
import { confirmCreateNote } from './confirm-create-modal'
import { Platform, TFile, type Plugin } from 'obsidian'

export class JournalHeaderFeature extends PluginFeature {
  constructor(plugin: Plugin) {
    super(plugin)
  }

  async load() {
    this.plugin.registerMarkdownCodeBlockProcessor(
      'journal-header',
      (source, el, ctx) => {
        try {
          const currentFile = this.plugin.app.vault.getAbstractFileByPath(
            ctx.sourcePath
          )

          if (currentFile instanceof TFile) {
            const settings: JournalFolderSettings = this.getSettings(
              currentFile,
              source
            )
            const note: JournalNote =
              journalNoteFactoryWithSettings(settings)(currentFile)
            const info: JournalHeaderInfo = buildJournalHeaderInfo(
              settings,
              note
            )
            const app = this.plugin.app
            const sourcePath = ctx.sourcePath
            const confirmCreate = (basename: string) =>
              confirmCreateNote(app, basename)
            const navigate = (linktext: string) => {
              app.workspace.openLinkText(linktext, sourcePath, false)
            }
            const defaultCalendarVisible = isTruthy(
              settings.defaultCalendarVisible
            )
            const isMobile = Platform.isMobile
            // @ts-ignore
            mount(JournalHeader, {
              target: el,
              props: {
                info,
                note,
                confirmCreate,
                navigate,
                defaultCalendarVisible,
                isMobile,
              },
            })
          } else {
            this.mountError(el, `No current file present (${ctx.sourcePath})`)
          }
        } catch (error) {
          this.mountError(el, `${error}`)
        }
      }
    )
  }

  private mountError(el: HTMLElement, error: string): void {
    mount(ErrorMessage, { target: el, props: { error: `${error}` } })
  }
}

// Folder front-matter and embedded code-block configs are merged in by
// FolderSettingsResolver as raw values, so a boolean field can arrive as a
// real boolean (YAML), the string "true"/"false" (embedded `key: value`
// lines), or anything else a user typed. Treat the string "false" — and
// only that — as false; defer to JS truthiness for everything else.
function isTruthy(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().toLowerCase() !== 'false'
  return Boolean(value)
}
