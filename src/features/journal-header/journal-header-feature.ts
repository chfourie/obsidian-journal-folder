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
  buildTemplatePreviewNote,
  findJournalFolderPaths,
  isJournalFileBasename,
  type JournalFolderSettings,
  JournalNote,
  journalNoteFactoryWithSettings,
  PluginFeature,
  templateFileTier,
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
import {
  MarkdownRenderChild,
  Platform,
  TFile,
  TFolder,
  type Plugin,
} from 'obsidian'

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
            // Resolve the note this header renders for. In a real journal
            // note it's the file itself. In a standardized *template note*
            // (e.g. `monthly.md` in the template folder) it's a synthetic
            // note for the *current* period of that tier, so editing the
            // template previews exactly what a fresh entry would look like.
            // Anywhere else the block is meaningless (e.g. pasted into
            // `journal-folder.md` or a non-journal note) — render nothing so
            // the template body stays portable.
            const resolved = this.resolveHeaderNote(currentFile, settings)
            if (!resolved) return
            const { note, isTemplate } = resolved
            const info: JournalHeaderInfo = buildJournalHeaderInfo(
              settings,
              note
            )
            const app = this.plugin.app
            const sourcePath = ctx.sourcePath
            // In a template preview the header is **display only**: every link
            // is pointed at the template file itself (so clicking navigates to
            // the note you're already on — a visual no-op) and the create
            // prompt is suppressed, since the synthetic note's siblings don't
            // really exist. `navOverrideUrl` is the link text Obsidian (and our
            // own handlers) resolve against `sourcePath` — the template's own
            // basename round-trips to itself.
            const navOverrideUrl = isTemplate ? currentFile.basename : undefined
            const confirmCreate = isTemplate
              ? async () => false
              : (basename: string) => confirmCreateNote(app, basename)
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
                navOverrideUrl,
                isTemplate,
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

  // Resolves the note this header renders for. A real journal note renders
  // for itself (`isTemplate: false`); a standardized template note renders
  // for a synthetic current-period note of its tier (`isTemplate: true`, which
  // makes the header display-only). Returns null when the block sits in a note
  // that's neither — render nothing so the block stays portable.
  private resolveHeaderNote(
    file: TFile,
    settings: JournalFolderSettings
  ): { note: JournalNote; isTemplate: boolean } | null {
    const quartersEnabled = isTruthySetting(settings.quartersEnabled)
    if (isJournalFileBasename(file.basename, quartersEnabled)) {
      return {
        note: journalNoteFactoryWithSettings(settings)(file),
        isTemplate: false,
      }
    }
    const tier = templateFileTier({
      filePath: file.path,
      globalTemplateFolder: settings.templateFolder,
      overrideName: settings.templateOverrideFolderName,
      journalFolderPaths: findJournalFolderPaths(this.plugin.app),
    })
    if (tier === null) return null
    const folder = file.parent
    if (!(folder instanceof TFolder)) return null
    const note = buildTemplatePreviewNote(
      this.plugin.app,
      settings,
      tier,
      folder
    )
    return note ? { note, isTemplate: true } : null
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
