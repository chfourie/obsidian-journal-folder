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

import { mount, unmount } from 'svelte'
import {
  isJournalFileBasename,
  type JournalFolderSettings,
  JournalNote,
  journalNoteFactoryWithSettings,
  PluginFeature,
} from 'src/data-access'
import { isTruthySetting } from '../journal-auto-template/auto-template-content'
import { ErrorMessage } from 'src/ui'
import JournalHeader from './JournalHeader.svelte'
import {
  buildJournalHeaderInfo,
  type JournalHeaderInfo,
} from './journal-header-info'
import { confirmCreateNote } from './confirm-create-modal'
import { resolveDefaultCalendarVisible } from './resolve-default-calendar-visible'
import { MarkdownRenderChild, Platform, TFile, type Plugin } from 'obsidian'

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
            // The `journal-header` block is meaningless outside a journal
            // note (e.g. when included in a template body that has been
            // pasted into `journal-folder.md` itself, or copied into a
            // non-journal note). Render nothing instead of an error so the
            // template body is portable.
            if (
              !isJournalFileBasename(
                currentFile.basename,
                isTruthySetting(settings.quartersEnabled)
              )
            ) {
              return
            }
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
            const isMobile = Platform.isMobile
            const defaultCalendarVisible = resolveDefaultCalendarVisible(
              settings,
              isMobile
            )
            // @ts-ignore
            const component = mount(JournalHeader, {
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
            ctx.addChild(new SvelteRenderChild(el, component))
          } else {
            this.mountError(el, ctx, `No current file present (${ctx.sourcePath})`)
          }
        } catch (error) {
          this.mountError(el, ctx, `${error}`)
        }
      }
    )
  }

  private mountError(
    el: HTMLElement,
    ctx: { addChild: (child: MarkdownRenderChild) => void },
    error: string
  ): void {
    const component = mount(ErrorMessage, {
      target: el,
      props: { error: `${error}` },
    })
    ctx.addChild(new SvelteRenderChild(el, component))
  }
}

// Pairs a Svelte 5 mount() with the markdown post-processor lifecycle so
// every re-render of the code block tears down its component instance and
// the listeners/effects it registered. Without this, switching between
// edit/preview or scrolling the code block in/out of view leaks one Svelte
// instance per fire of the processor.
class SvelteRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private component: ReturnType<typeof mount>
  ) {
    super(containerEl)
  }

  onunload(): void {
    try {
      unmount(this.component)
    } catch {
      // Defensive: if the component is already torn down, swallow.
    }
  }
}
