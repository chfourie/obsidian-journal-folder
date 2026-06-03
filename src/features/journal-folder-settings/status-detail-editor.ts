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

import { Setting } from 'obsidian'
import type {
  IconSource,
  JournalFolderSettings,
  ShellShape,
  TaskRendering,
  TaskStatus,
} from '../../data-access'
import { buildTaskModel } from '../journal-tasks/task-models'
import { renderStatusIcon } from '../journal-tasks/render-status-icon'
import { renderColorPicker } from './color-picker'
import { renderEmojiPicker, renderLucidePicker } from './icon-pickers'

// Sections inside the inline status editor. Mirrors the layout the
// modal had — Basics is always available; Icon, Background, and
// Border are gated on `rendering` and `shape`.
export type StatusDetailSection =
  | 'basics'
  | 'icon'
  | 'background'
  | 'border'

export type StatusDetailConfig = {
  containerEl: HTMLElement
  settings: JournalFolderSettings
  flowName: string
  statusId: string
  // Sticky-across-renders nav state. The settings-form builder
  // owns it so structural re-renders preserve which section the
  // user is on.
  activeSection: StatusDetailSection
  setActiveSection: (next: StatusDetailSection) => void
  saveSettings: (next: JournalFolderSettings) => Promise<void>
  // Called when a structural change (rendering toggle, shape
  // change) needs the surrounding tab to redraw — e.g. nav items
  // gaining or losing the enabled state.
  rerender: () => void
}

// Renders the per-status detail panel: a sticky preview, a left
// nav listing Basics / Icon / Background / Border, and a right
// content panel showing the active section. Every input persists
// straight to settings on change — there is no Save/Cancel; the
// breadcrumb is the way back.
export function renderStatusDetail(config: StatusDetailConfig): void {
  const { containerEl, settings, flowName, statusId } = config
  const flow = settings.taskFlows[flowName] ?? []
  const index = flow.findIndex((s) => s.id === statusId)
  if (index < 0) {
    containerEl.createEl('p', {
      cls: 'jf-status-edit-panel-empty',
      text:
        'This status no longer exists — it may have been removed. ' +
        'Use the breadcrumb above to return to the flow.',
    })
    return
  }
  const status = flow[index]
  const siblings = flow

  const updateStatus = async (
    patch: Partial<TaskStatus>
  ): Promise<void> => {
    const nextFlow = flow.map((s, i) => (i === index ? { ...s, ...patch } : s))
    await config.saveSettings({
      ...settings,
      taskFlows: { ...settings.taskFlows, [flowName]: nextFlow },
    })
  }

  const editor = containerEl.createDiv({ cls: 'jf-status-edit-content' })
  renderPreview(editor, status)

  const split = editor.createDiv({ cls: 'jf-status-edit-split' })
  const navEl = split.createDiv({ cls: 'jf-status-edit-nav' })
  const panelEl = split.createDiv({ cls: 'jf-status-edit-panel' })

  const sections = buildSectionTable(status, panelEl, {
    updateStatus,
    siblings,
    saveSettings: (next) => config.saveSettings(next),
    settings,
    flowName,
    index,
    rerender: config.rerender,
  })

  let active = config.activeSection
  if (!sections[active].isEnabled()) active = 'basics'
  if (active !== config.activeSection) config.setActiveSection(active)

  for (const id of NAV_ORDER) {
    const section = sections[id]
    const enabled = section.isEnabled()
    const btn = navEl.createEl('button', {
      cls: 'jf-status-edit-nav-item',
      text: section.label,
    })
    btn.type = 'button'
    if (id === active) btn.addClass('is-active')
    if (!enabled) {
      btn.addClass('is-disabled')
      btn.disabled = true
      btn.title = section.disabledReason()
    } else {
      btn.onclick = (e) => {
        e.preventDefault()
        config.setActiveSection(id)
        config.rerender()
      }
    }
  }

  sections[active].render()
}

// ---- preview --------------------------------------------------

function renderPreview(parent: HTMLElement, status: TaskStatus): void {
  const wrap = parent.createDiv({ cls: 'jf-status-edit-preview' })
  wrap.createSpan({
    cls: 'jf-status-edit-preview-caption',
    text: 'Preview',
  })
  const row = wrap.createDiv({ cls: 'jf-status-edit-preview-row' })
  const shell = row.createSpan({ cls: 'jf-status-edit-preview-icon' })

  if (status.rendering === 'theme') {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'task-list-item-checkbox'
    input.setAttribute('data-task', status.char)
    input.checked = status.char !== ' '
    input.disabled = true
    shell.appendChild(input)
  } else {
    const iconShell = document.createElement('span')
    iconShell.className = 'jf-task-status'
    shell.appendChild(iconShell)
    const model = buildTaskModel([status])
    renderStatusIcon(iconShell, status, model)
  }

  row.createSpan({
    cls: 'jf-status-edit-preview-text',
    text: `[${status.char}] ${status.label || status.id}`,
  })
}

// ---- section table -------------------------------------------

const NAV_ORDER: StatusDetailSection[] = [
  'basics',
  'icon',
  'background',
  'border',
]

type SectionEntry = {
  label: string
  isEnabled: () => boolean
  disabledReason: () => string
  render: () => void
}

type SectionDeps = {
  updateStatus: (patch: Partial<TaskStatus>) => Promise<void>
  siblings: TaskStatus[]
  saveSettings: (next: JournalFolderSettings) => Promise<void>
  settings: JournalFolderSettings
  flowName: string
  index: number
  rerender: () => void
}

function buildSectionTable(
  status: TaskStatus,
  panel: HTMLElement,
  deps: SectionDeps
): Record<StatusDetailSection, SectionEntry> {
  return {
    basics: {
      label: 'Basics',
      isEnabled: () => true,
      disabledReason: () => '',
      render: () => renderBasics(panel, status, deps),
    },
    icon: {
      label: 'Icon',
      isEnabled: () => status.rendering === 'plugin',
      disabledReason: () =>
        'Rendering is set to "Theme checkbox" — the active theme paints ' +
        'the status, so the plugin doesn’t use a custom icon.',
      render: () => renderIconSection(panel, status, deps),
    },
    background: {
      label: 'Background',
      isEnabled: () =>
        status.rendering === 'plugin' && status.shell.shape !== 'none',
      disabledReason: () =>
        status.rendering === 'theme'
          ? 'Rendering is set to "Theme checkbox" — the active theme ' +
            'paints the shell.'
          : 'No shell to paint — set a shape on the Background panel first.',
      render: () => renderBackgroundSection(panel, status, deps),
    },
    border: {
      label: 'Border',
      isEnabled: () =>
        status.rendering === 'plugin' && status.shell.shape !== 'none',
      disabledReason: () =>
        status.rendering === 'theme'
          ? 'Rendering is set to "Theme checkbox" — the active theme ' +
            'paints the border.'
          : 'No shell to border — set a shape on the Background panel first.',
      render: () => renderBorderSection(panel, status, deps),
    },
  }
}

// ---- Basics --------------------------------------------------

function renderBasics(
  panel: HTMLElement,
  status: TaskStatus,
  deps: SectionDeps
): void {
  new Setting(panel)
    .setName('Label')
    .setDesc('Shown in the status menu and as the row title.')
    .addText((t) =>
      t.setValue(status.label).onChange((v) => {
        // noinspection JSIgnoredPromiseFromCall
        deps.updateStatus({ label: v })
      })
    )

  new Setting(panel)
    .setName('Markdown character')
    .setDesc(
      'Single character that lives inside the `[ ]` on disk. ' +
        'Stick to the community alphabet (space, x, /, >, -, ?, d, …) ' +
        'for the best theme coverage.'
    )
    .addText((t) => {
      t.setValue(status.char).onChange((v) => {
        const char = v.length === 0 ? ' ' : v.charAt(0)
        // noinspection JSIgnoredPromiseFromCall
        deps.updateStatus({ char })
      })
      t.inputEl.maxLength = 1
      t.inputEl.style.width = '3em'
      t.inputEl.style.textAlign = 'center'
    })

  new Setting(panel)
    .setName('Active')
    .setDesc(
      'On — the status counts as still-open work. Off — treated as ' +
        'completed (hidden when the user toggles "Hide completed").'
    )
    .addToggle((toggle) =>
      toggle.setValue(!status.isDone).onChange((v) => {
        // noinspection JSIgnoredPromiseFromCall
        deps.updateStatus({ isDone: !v })
      })
    )

  new Setting(panel)
    .setName('Next status')
    .setDesc('The status this one transitions to on left-click.')
    .addDropdown((dd) => {
      for (const s of deps.siblings) {
        dd.addOption(s.id, s.label || s.id)
      }
      dd.setValue(status.next).onChange((v) => {
        // noinspection JSIgnoredPromiseFromCall
        deps.updateStatus({ next: v })
      })
    })

  new Setting(panel)
    .setName('Rendering')
    .setDesc(
      'Plugin icons — paint a custom shell + icon (Icon, Background, ' +
        'Border sections take over). Theme checkbox — leave Obsidian’s ' +
        'native checkbox visible so the active theme styles it. Useful ' +
        'when a theme supports some characters but not others.'
    )
    .addDropdown((dd) => {
      dd.addOption('plugin', 'Plugin icons')
      dd.addOption('theme', 'Theme checkbox')
      dd.setValue(status.rendering).onChange(async (v) => {
        const rendering: TaskRendering = v === 'theme' ? 'theme' : 'plugin'
        await deps.updateStatus({ rendering })
        // Rendering flips Icon / Background / Border between enabled
        // and disabled in the nav — refresh the surrounding view.
        deps.rerender()
      })
    })
}

// ---- Icon ----------------------------------------------------

function renderIconSection(
  panel: HTMLElement,
  status: TaskStatus,
  deps: SectionDeps
): void {
  const colorWrap = { el: null as HTMLDivElement | null }
  const insetWrap = { el: null as HTMLDivElement | null }

  const refreshConditionals = (): void => {
    const kind = status.icon.source.kind
    colorWrap.el?.toggle(iconColorApplies(kind))
    insetWrap.el?.toggle(kind !== 'none')
  }

  new Setting(panel)
    .setName('Source')
    .setDesc(
      'Lucide names ship with Obsidian. Emoji renders as text. ' +
        'Image takes a vault-relative or absolute URL. SVG accepts ' +
        'raw markup (sanitised before render).'
    )
    .addDropdown((dd) => {
      dd.addOption('none', 'none')
      dd.addOption('lucide', 'lucide')
      dd.addOption('emoji', 'emoji')
      dd.addOption('image', 'image')
      dd.addOption('svg', 'svg')
      dd.setValue(status.icon.source.kind).onChange(async (v) => {
        await deps.updateStatus({
          icon: {
            ...status.icon,
            source: blankSource(v as IconSource['kind']),
          },
        })
        deps.rerender()
      })
    })

  const payloadHost = panel.createDiv({
    cls: 'jf-status-edit-icon-payload',
  })

  const renderPayload = (): void => {
    payloadHost.empty()
    const src = status.icon.source
    if (src.kind === 'lucide') {
      renderLucidePicker({
        containerEl: payloadHost,
        value: src.name,
        onChange: (name) => {
          // noinspection JSIgnoredPromiseFromCall
          deps.updateStatus({
            icon: { ...status.icon, source: { kind: 'lucide', name } },
          })
        },
      })
    } else if (src.kind === 'emoji') {
      renderEmojiPicker({
        containerEl: payloadHost,
        value: src.emoji,
        onChange: (emoji) => {
          // noinspection JSIgnoredPromiseFromCall
          deps.updateStatus({
            icon: { ...status.icon, source: { kind: 'emoji', emoji } },
          })
        },
      })
    } else if (src.kind === 'image') {
      new Setting(payloadHost)
        .setName('Image URL')
        .addText((t) =>
          t.setValue(src.url).onChange((v) => {
            // noinspection JSIgnoredPromiseFromCall
            deps.updateStatus({
              icon: { ...status.icon, source: { kind: 'image', url: v } },
            })
          })
        )
    } else if (src.kind === 'svg') {
      new Setting(payloadHost)
        .setName('SVG markup')
        .setDesc(
          'Pasted SVG is sanitised before render — script tags, event ' +
            'handlers, and javascript:/data: URLs are stripped. Invalid ' +
            'markup is silently dropped at paint time.'
        )
        .addTextArea((area) => {
          area.setValue(src.markup).onChange((v) => {
            // noinspection JSIgnoredPromiseFromCall
            deps.updateStatus({
              icon: { ...status.icon, source: { kind: 'svg', markup: v } },
            })
          })
          area.inputEl.rows = 6
          area.inputEl.style.width = '100%'
          area.inputEl.style.fontFamily = 'var(--font-monospace)'
        })
    } else {
      payloadHost.createEl('p', {
        cls: 'jf-status-edit-panel-empty',
        text:
          'No icon — the shell stands on its own (e.g. an empty ring ' +
          'or a filled circle).',
      })
    }
  }
  renderPayload()

  colorWrap.el = panel.createDiv({ cls: 'jf-status-edit-subsection' })
  new Setting(colorWrap.el)
    .setName('Icon colour')
    .setDesc('Foreground for monochrome glyphs (Lucide, monochrome SVG).')
  const colorHost = colorWrap.el.createDiv()
  renderColorPicker({
    containerEl: colorHost,
    compact: true,
    value: status.icon.color,
    onChange: (next) => {
      // noinspection JSIgnoredPromiseFromCall
      deps.updateStatus({ icon: { ...status.icon, color: next } })
    },
  })

  insetWrap.el = panel.createDiv({ cls: 'jf-status-edit-subsection' })
  new Setting(insetWrap.el)
    .setName('Inset (0–1)')
    .setDesc(
      'How much of the shell the icon fills. ~0.7 leaves a small ' +
        'ring of background. 1.0 fills the whole shell box (use for ' +
        'shape "none").'
    )
    .addText((t) => {
      t.setValue(String(status.icon.inset ?? 0.7)).onChange((v) => {
        const num = Number.parseFloat(v)
        if (Number.isFinite(num) && num >= 0 && num <= 1) {
          // noinspection JSIgnoredPromiseFromCall
          deps.updateStatus({ icon: { ...status.icon, inset: num } })
        }
      })
      t.inputEl.type = 'number'
      t.inputEl.min = '0'
      t.inputEl.max = '1'
      t.inputEl.step = '0.05'
      t.inputEl.style.width = '5em'
    })

  refreshConditionals()
}

// ---- Background ----------------------------------------------

function renderBackgroundSection(
  panel: HTMLElement,
  status: TaskStatus,
  deps: SectionDeps
): void {
  new Setting(panel)
    .setName('Shape')
    .setDesc(
      'Frame around the icon. "None" hides the shell entirely ' +
        '(useful for icon-only statuses like a coloured chevron).'
    )
    .addDropdown((dd) => {
      const shapes: ShellShape[] = [
        'none',
        'circle',
        'square',
        'rounded-square',
      ]
      for (const shape of shapes) dd.addOption(shape, shape)
      dd.setValue(status.shell.shape).onChange(async (v) => {
        await deps.updateStatus({
          shell: { ...status.shell, shape: v as ShellShape },
        })
        deps.rerender()
      })
    })

  new Setting(panel)
    .setName('Background colour')
    .setDesc('Leave clear for an outlined / transparent shell.')
  const bgHost = panel.createDiv()
  renderColorPicker({
    containerEl: bgHost,
    compact: true,
    value: status.shell.background,
    onChange: (next) => {
      // noinspection JSIgnoredPromiseFromCall
      deps.updateStatus({
        shell: { ...status.shell, background: next },
      })
    },
  })
}

// ---- Border --------------------------------------------------

function renderBorderSection(
  panel: HTMLElement,
  status: TaskStatus,
  deps: SectionDeps
): void {
  const widthWrap = { el: null as HTMLDivElement | null }
  const colorWrap = { el: null as HTMLDivElement | null }

  const refresh = (): void => {
    const has = !!status.shell.border
    widthWrap.el?.toggle(has)
    colorWrap.el?.toggle(has)
  }

  new Setting(panel)
    .setName('Border')
    .setDesc('Outlined ring around the shell.')
    .addToggle((toggle) =>
      toggle.setValue(!!status.shell.border).onChange(async (value) => {
        const nextBorder = value
          ? status.shell.border ?? {
              color: { kind: 'token' as const, var: '--checkbox-border-color' },
              width: 1,
            }
          : null
        await deps.updateStatus({
          shell: { ...status.shell, border: nextBorder },
        })
        // The width / colour rows toggle in-place via `display: none`
        // rather than a full rerender so the user doesn't lose focus.
        widthWrap.el?.toggle(!!nextBorder)
        colorWrap.el?.toggle(!!nextBorder)
      })
    )

  widthWrap.el = panel.createDiv({ cls: 'jf-status-edit-subsection' })
  new Setting(widthWrap.el).setName('Border width (px)').addText((t) => {
    t.setValue(String(status.shell.border?.width ?? 1)).onChange((v) => {
      const num = Number.parseFloat(v)
      if (Number.isFinite(num) && num >= 0 && status.shell.border) {
        // noinspection JSIgnoredPromiseFromCall
        deps.updateStatus({
          shell: {
            ...status.shell,
            border: { ...status.shell.border, width: num },
          },
        })
      }
    })
    t.inputEl.type = 'number'
    t.inputEl.min = '0'
    t.inputEl.step = '0.5'
    t.inputEl.style.width = '5em'
  })

  colorWrap.el = panel.createDiv({ cls: 'jf-status-edit-subsection' })
  new Setting(colorWrap.el).setName('Border colour')
  const colorHost = colorWrap.el.createDiv()
  renderColorPicker({
    containerEl: colorHost,
    compact: true,
    allowClear: false,
    value: status.shell.border?.color ?? {
      kind: 'token',
      var: '--checkbox-border-color',
    },
    onChange: (next) => {
      if (next && status.shell.border) {
        // noinspection JSIgnoredPromiseFromCall
        deps.updateStatus({
          shell: {
            ...status.shell,
            border: { ...status.shell.border, color: next },
          },
        })
      }
    },
  })

  refresh()
}

// ---- helpers --------------------------------------------------

function iconColorApplies(kind: IconSource['kind']): boolean {
  return kind === 'lucide' || kind === 'svg'
}

function blankSource(kind: IconSource['kind']): IconSource {
  switch (kind) {
    case 'lucide':
      return { kind: 'lucide', name: 'check' }
    case 'emoji':
      return { kind: 'emoji', emoji: '✓' }
    case 'image':
      return { kind: 'image', url: '' }
    case 'svg':
      return { kind: 'svg', markup: '' }
    default:
      return { kind: 'none' }
  }
}
