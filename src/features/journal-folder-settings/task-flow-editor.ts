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

import {
  type App,
  ButtonComponent,
  Modal,
  Notice,
  setIcon,
  Setting,
} from 'obsidian'
import {
  BUILTIN_TEMPLATES,
  BUILTIN_TEMPLATE_LABELS,
  type BuiltInTemplateId,
  cloneTemplate,
  DEFAULT_TEMPLATE_ID,
  findFoldersUsingTaskFlow,
  isBuiltInTemplate,
  type JournalFolderSettings,
  type TaskRendering,
  type TaskStatus,
} from '../../data-access'
import { reorder } from './reorder-statuses'
import { buildTaskModel } from '../journal-tasks/task-models'
import { renderStatusIcon } from '../journal-tasks/render-status-icon'

// =============================================================
// Top-level Tasks overview: list of flows + default-flow picker +
// add-new-flow. Drilling into a flow replaces the tab content via
// `onOpenFlow` (handled by the surrounding settings tab).
// =============================================================

export type TaskFlowOverviewConfig = {
  app: App
  containerEl: HTMLElement
  getSettings: () => JournalFolderSettings
  saveSettings: (settings: JournalFolderSettings) => Promise<void>
  rerender: () => void
  onOpenFlow: (flowName: string) => void
}

export function renderTaskFlowOverview(config: TaskFlowOverviewConfig): void {
  const { app, containerEl, getSettings, saveSettings, rerender, onOpenFlow } =
    config
  const settings = getSettings()
  const flowNames = Object.keys(settings.taskFlows).sort()

  // Default-flow selector. Sits at the top because it's a
  // global-level decision (which flow folders inherit when they
  // don't override).
  new Setting(containerEl)
    .setName('Default flow')
    .setDesc(
      'Used by every folder that hasn’t set its own flow override, ' +
        'and as the fallback when a folder points at a flow that no ' +
        'longer exists.'
    )
    .addDropdown((dd) => {
      for (const name of flowNames) dd.addOption(name, name)
      dd.setValue(settings.defaultTaskFlow).onChange(async (value) => {
        await saveSettings({ ...settings, defaultTaskFlow: value })
        rerender()
      })
    })
    .addButton((btn) => {
      btn
        .setButtonText('Add new flow…')
        .setCta()
        .onClick(() => {
          new AddFlowModal(app, settings, async (name, templateId) => {
            const seed = BUILTIN_TEMPLATES[templateId]
            await saveSettings({
              ...settings,
              taskFlows: {
                ...settings.taskFlows,
                [name]: {
                  statuses: cloneTemplate(seed),
                  rendering: 'plugin',
                },
              },
            })
            onOpenFlow(name)
          }).open()
        })
    })

  // Flow list — one Setting row per flow. Click "Open" (or the
  // entire row) to drill into the detail view. Default flow is
  // labelled in the description so users don't have to memorise it.
  for (const name of flowNames) {
    const flow = settings.taskFlows[name]
    const statusList = flow?.statuses ?? []
    const isDefault = name === settings.defaultTaskFlow
    const statusCount = `${statusList.length} status${
      statusList.length === 1 ? '' : 'es'
    }`
    const desc = isDefault
      ? `Default flow · ${statusCount}`
      : statusCount

    const row = new Setting(containerEl)
      .setName(name)
      .setDesc(desc)
      .addExtraButton((btn) => {
        btn
          .setIcon('chevron-right')
          .setTooltip(`Open ${name}`)
          .onClick(() => onOpenFlow(name))
      })

    row.settingEl.addClass('jf-flow-row')
    if (isDefault) row.settingEl.addClass('is-default')
    // Make the whole row a single click target — easier than aiming
    // for the chevron, especially on touch.
    row.settingEl.onclick = (e) => {
      // Don't double-fire when the user clicks the explicit button.
      if ((e.target as HTMLElement).closest('button')) return
      onOpenFlow(name)
    }
  }
}

// =============================================================
// Flow detail: per-flow actions (apply template, save as, delete)
// + status list with drill-into-status buttons.
// =============================================================

export type TaskFlowDetailConfig = {
  app: App
  containerEl: HTMLElement
  flowName: string
  getSettings: () => JournalFolderSettings
  saveSettings: (settings: JournalFolderSettings) => Promise<void>
  rerender: () => void
  onOpenStatus: (statusId: string) => void
  // Called after the flow has been deleted so the surrounding tab
  // can pop back to the overview.
  onFlowDeleted: () => void
  // Called after Save as creates a new flow so the surrounding tab
  // can navigate into the freshly-created clone.
  onFlowRenamed: (newName: string) => void
}

export function renderTaskFlowDetail(config: TaskFlowDetailConfig): void {
  const {
    app,
    containerEl,
    flowName,
    getSettings,
    saveSettings,
    rerender,
    onOpenStatus,
    onFlowDeleted,
    onFlowRenamed,
  } = config

  const settings = getSettings()
  const flow = settings.taskFlows[flowName]
  if (!flow) {
    containerEl.createEl('p', {
      cls: 'jf-status-edit-panel-empty',
      text:
        `The flow "${flowName}" no longer exists — it may have been ` +
        'deleted. Use the breadcrumb above to return to the overview.',
    })
    return
  }

  const flowStatuses = flow.statuses
  const isDefault = flowName === settings.defaultTaskFlow

  // ---- flow rendering -------------------------------------------
  new Setting(containerEl)
    .setName('Rendering')
    .setDesc(
      'How every status in this flow is painted. Plugin icons — paint ' +
        'a custom shell + icon driven by the per-status Icon / Background ' +
        '/ Border settings. Theme checkbox — leave Obsidian’s native ' +
        'checkbox visible so the active theme styles it via ' +
        '`data-task`. One mode per flow — mixing inside one nested list ' +
        'does not paint reliably.'
    )
    .addDropdown((dd) => {
      dd.addOption('plugin', 'Plugin icons')
      dd.addOption('theme', 'Theme checkbox')
      dd.setValue(flow.rendering).onChange(async (v) => {
        const rendering: TaskRendering = v === 'theme' ? 'theme' : 'plugin'
        await saveSettings({
          ...settings,
          taskFlows: {
            ...settings.taskFlows,
            [flowName]: { ...flow, rendering },
          },
        })
        rerender()
      })
    })

  // ---- flow actions ---------------------------------------------
  new Setting(containerEl)
    .setName('Apply template')
    .setDesc(
      'Replace this flow’s statuses with a built-in template. ' +
        'Destructive — use "Save as new flow" first if you want to ' +
        'keep the current statuses.'
    )
    .addDropdown((dd) => {
      for (const id of Object.keys(BUILTIN_TEMPLATES) as BuiltInTemplateId[]) {
        dd.addOption(id, BUILTIN_TEMPLATE_LABELS[id])
      }
      dd.setValue(DEFAULT_TEMPLATE_ID)
      dd.selectEl.dataset.jfApplyTemplate = DEFAULT_TEMPLATE_ID
      dd.onChange((value) => {
        dd.selectEl.dataset.jfApplyTemplate = value
      })
    })
    .addButton((btn) => {
      btn.setButtonText('Apply').onClick(() => {
        const select = containerEl.querySelector<HTMLSelectElement>(
          'select[data-jf-apply-template]'
        )
        const templateId = (select?.dataset.jfApplyTemplate ??
          DEFAULT_TEMPLATE_ID) as BuiltInTemplateId
        new ConfirmApplyTemplateModal(
          app,
          flowName,
          BUILTIN_TEMPLATE_LABELS[templateId],
          async () => {
            await saveSettings({
              ...settings,
              taskFlows: {
                ...settings.taskFlows,
                [flowName]: {
                  ...flow,
                  statuses: cloneTemplate(BUILTIN_TEMPLATES[templateId]),
                },
              },
            })
            rerender()
          }
        ).open()
      })
    })

  new Setting(containerEl)
    .setName('Save as new flow…')
    .setDesc('Clone this flow under a new name.')
    .addButton((btn) => {
      btn.setButtonText('Save as…').onClick(() => {
        new SaveAsFlowModal(app, settings, async (name) => {
          await saveSettings({
            ...settings,
            taskFlows: {
              ...settings.taskFlows,
              [name]: {
                statuses: cloneTemplate(flowStatuses),
                rendering: flow.rendering,
              },
            },
          })
          onFlowRenamed(name)
        }).open()
      })
    })

  new Setting(containerEl)
    .setName('Delete flow')
    .setDesc(
      'Folders pointing at this flow will revert to the default flow.'
    )
    .addButton((btn) => {
      const flowCount = Object.keys(settings.taskFlows).length
      btn
        .setButtonText('Delete')
        .setWarning()
        .setDisabled(flowCount <= 1 || isDefault)
        .setTooltip(
          isDefault
            ? 'The default flow cannot be deleted. Set another flow ' +
                'as the default first.'
            : flowCount <= 1
              ? 'At least one flow must exist.'
              : `Delete the flow "${flowName}".`
        )
        .onClick(() => {
          const usages = findFoldersUsingTaskFlow(app, flowName)
          new ConfirmDeleteFlowModal(app, flowName, usages, async () => {
            const { [flowName]: _omit, ...rest } = settings.taskFlows
            await saveSettings({ ...settings, taskFlows: rest })
            onFlowDeleted()
          }).open()
        })
    })

  // ---- status list editor ---------------------------------------
  new Setting(containerEl)
    .setName('Statuses')
    .setHeading()
    .setDesc(
      'Drag a row to reorder. Click Edit to drill into the status ' +
        '(label, character, shell, icon, colours).'
    )
    .addButton((btn) => {
      btn
        .setButtonText('Add status')
        .setCta()
        .onClick(async () => {
          const id = generateUniqueStatusId(flowStatuses)
          const newStatus: TaskStatus = {
            id,
            label: 'New status',
            char: pickUnusedChar(flowStatuses),
            isDone: false,
            next: flowStatuses[0]?.id ?? id,
            shell: {
              shape: 'circle',
              border: {
                color: { kind: 'token', var: '--checkbox-border-color' },
                width: 1,
              },
            },
            icon: { source: { kind: 'none' } },
          }
          await saveSettings({
            ...settings,
            taskFlows: {
              ...settings.taskFlows,
              [flowName]: {
                ...flow,
                statuses: [...flowStatuses, newStatus],
              },
            },
          })
          onOpenStatus(id)
        })
    })

  const listEl = containerEl.createDiv({ cls: 'jf-status-list' })
  const dragState = { fromIndex: null as number | null }

  for (let i = 0; i < flowStatuses.length; i++) {
    renderStatusRow({
      app,
      listEl,
      settings,
      flowName,
      flowRendering: flow.rendering,
      index: i,
      saveSettings,
      rerender,
      onOpenStatus,
      dragState,
    })
  }
}

// =============================================================
// Per-folder slim picker — unchanged from before.
// =============================================================

export type FolderTaskFlowSectionConfig = {
  containerEl: HTMLElement
  getSettings: () => JournalFolderSettings
  saveSettings: (settings: JournalFolderSettings) => Promise<void>
}

export function renderFolderTaskFlowSection(
  config: FolderTaskFlowSectionConfig
): void {
  const { containerEl, getSettings, saveSettings } = config
  const settings = getSettings()
  const flowNames = Object.keys(settings.taskFlows).sort()
  const current = settings.taskFlow ?? ''

  new Setting(containerEl)
    .setName('Task flow')
    .setDesc(
      `Default: ${settings.defaultTaskFlow || '(none)'}. Pick another ` +
        'named flow to override for this folder only.'
    )
    .addDropdown((dd) => {
      dd.addOption('', `Use default (${settings.defaultTaskFlow || 'none'})`)
      for (const name of flowNames) dd.addOption(name, name)
      const value = flowNames.includes(current) ? current : ''
      dd.setValue(value).onChange(async (next) => {
        await saveSettings({ ...settings, taskFlow: next })
      })
    })
}

// =============================================================
// Status list row (drag-reorder + drill-in + remove)
// =============================================================

type StatusRowConfig = {
  app: App
  listEl: HTMLElement
  settings: JournalFolderSettings
  flowName: string
  flowRendering: TaskRendering
  index: number
  saveSettings: (next: JournalFolderSettings) => Promise<void>
  rerender: () => void
  onOpenStatus: (statusId: string) => void
  dragState: { fromIndex: number | null }
}

function renderStatusRow(config: StatusRowConfig): void {
  const {
    app,
    listEl,
    settings,
    flowName,
    flowRendering,
    index,
    saveSettings,
    rerender,
    onOpenStatus,
    dragState,
  } = config
  const flow = settings.taskFlows[flowName]
  const flowStatuses = flow?.statuses ?? []
  const status = flowStatuses[index]

  const updateFlow = async (nextStatuses: TaskStatus[]): Promise<void> => {
    await saveSettings({
      ...settings,
      taskFlows: {
        ...settings.taskFlows,
        [flowName]: {
          ...(flow ?? { rendering: flowRendering }),
          statuses: nextStatuses,
        },
      },
    })
  }

  const rowEl = listEl.createDiv({ cls: 'jf-status-row' })
  rowEl.draggable = true
  rowEl.dataset.index = String(index)

  rowEl.addEventListener('dragstart', (evt) => {
    dragState.fromIndex = index
    rowEl.addClass('is-dragging')
    if (evt.dataTransfer) {
      evt.dataTransfer.effectAllowed = 'move'
      evt.dataTransfer.setData('text/plain', String(index))
    }
  })
  rowEl.addEventListener('dragend', () => {
    rowEl.removeClass('is-dragging')
    dragState.fromIndex = null
    listEl
      .findAll('.jf-status-row')
      .forEach((el) => el.removeClass('is-drop-target'))
  })
  rowEl.addEventListener('dragover', (evt) => {
    if (dragState.fromIndex === null) return
    evt.preventDefault()
    rowEl.addClass('is-drop-target')
  })
  rowEl.addEventListener('dragleave', () => {
    rowEl.removeClass('is-drop-target')
  })
  rowEl.addEventListener('drop', async (evt) => {
    evt.preventDefault()
    const from = dragState.fromIndex
    dragState.fromIndex = null
    rowEl.removeClass('is-drop-target')
    if (from === null || from === index) return
    await updateFlow(reorder(flowStatuses, from, index))
    rerender()
  })

  const handleEl = rowEl.createSpan({ cls: 'jf-status-handle' })
  handleEl.setAttr('aria-hidden', 'true')
  setIcon(handleEl, 'grip-vertical')

  const previewEl = rowEl.createSpan({ cls: 'jf-status-preview' })
  paintStatusPreview(previewEl, status, flowStatuses, flowRendering)

  const charEl = rowEl.createSpan({ cls: 'jf-status-char' })
  charEl.setText(`[${status.char}]`)

  const labelEl = rowEl.createSpan({ cls: 'jf-status-label' })
  labelEl.setText(status.label || status.id)

  const flowEl = rowEl.createSpan({ cls: 'jf-status-flow' })
  const nextStatus = flowStatuses.find((s) => s.id === status.next)
  flowEl.setText(
    `${status.isDone ? '✓ done · ' : ''}→ ${
      nextStatus?.label || status.next || '?'
    }`
  )

  const actionsEl = rowEl.createSpan({ cls: 'jf-status-actions' })

  const editBtn = actionsEl.createEl('button', {
    cls: 'jf-status-action',
    text: 'Edit',
  })
  editBtn.type = 'button'
  editBtn.onclick = (e) => {
    e.preventDefault()
    onOpenStatus(status.id)
  }

  const removeBtn = actionsEl.createEl('button', {
    cls: 'jf-status-action mod-warning',
    text: 'Remove',
  })
  removeBtn.type = 'button'
  removeBtn.onclick = (e) => {
    e.preventDefault()
    if (flowStatuses.length <= 1) {
      new Notice('A flow needs at least one status.')
      return
    }
    new ConfirmRemoveStatusModal(
      app,
      status.label || status.id,
      flowName,
      async () => {
        const removedId = status.id
        const nextStatuses = flowStatuses.filter((_, i) => i !== index)
        const fallback = nextStatuses[0].id
        const cleaned = nextStatuses.map((s) =>
          s.next === removedId ? { ...s, next: fallback } : s
        )
        await updateFlow(cleaned)
        rerender()
      }
    ).open()
  }
}

// =============================================================
// Breadcrumb helper used by the surrounding tab.
// =============================================================

export type BreadcrumbCrumb = {
  label: string
  onClick?: () => void
}

// Renders a clickable breadcrumb trail. The last crumb is always
// rendered as plain text (current location); earlier crumbs render
// as buttons when they carry an `onClick`.
export function renderBreadcrumb(
  containerEl: HTMLElement,
  crumbs: BreadcrumbCrumb[]
): void {
  const wrap = containerEl.createDiv({ cls: 'jf-breadcrumb' })
  for (let i = 0; i < crumbs.length; i++) {
    const crumb = crumbs[i]
    const isLast = i === crumbs.length - 1
    if (!isLast && crumb.onClick) {
      const btn = wrap.createEl('button', {
        cls: 'jf-breadcrumb-link',
        text: crumb.label,
      })
      btn.type = 'button'
      btn.onclick = (e) => {
        e.preventDefault()
        crumb.onClick?.()
      }
    } else {
      wrap.createSpan({
        cls: isLast ? 'jf-breadcrumb-current' : 'jf-breadcrumb-link',
        text: crumb.label,
      })
    }
    if (!isLast) {
      wrap.createSpan({ cls: 'jf-breadcrumb-sep', text: '›' })
    }
  }
}

// =============================================================
// Helpers + modals
// =============================================================

function generateUniqueStatusId(statuses: TaskStatus[]): string {
  const taken = new Set(statuses.map((s) => s.id))
  for (let i = 1; i < 100; i++) {
    const candidate = `status-${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `status-${Date.now()}`
}

// Paints a faithful preview of the status's rendered checkbox into
// `el` — the same shell / icon path the live task lists use, so the
// flow-editor row matches what the user will actually see in their
// notes. For `rendering: 'theme'` we drop a disabled native checkbox
// styled by the active theme; for `'plugin'` we go through
// `renderStatusIcon` against a single-status model built on the spot.
function paintStatusPreview(
  el: HTMLElement,
  status: TaskStatus,
  flowStatuses: TaskStatus[],
  rendering: TaskRendering
): void {
  while (el.firstChild) el.removeChild(el.firstChild)
  if (rendering === 'theme') {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'task-list-item-checkbox'
    input.setAttribute('data-task', status.char)
    input.checked = status.char !== ' '
    input.disabled = true
    el.appendChild(input)
    return
  }
  const iconShell = document.createElement('span')
  iconShell.className = 'jf-task-status'
  el.appendChild(iconShell)
  // The model is only consulted for its `id` (stamped as a data attr
  // for theming) and the `isDone` map; building one over just this
  // flow is enough for an accurate preview.
  const model = buildTaskModel(flowStatuses, rendering)
  renderStatusIcon(iconShell, status, model)
}

function pickUnusedChar(statuses: TaskStatus[]): string {
  const taken = new Set(statuses.map((s) => s.char.toLowerCase()))
  const palette = '~!@#$%^&*+=?abcdefghijklmnopqrstuvwxyz'
  for (const ch of palette) {
    if (!taken.has(ch)) return ch
  }
  return '?'
}

class AddFlowModal extends Modal {
  private name = ''
  private templateId: BuiltInTemplateId = DEFAULT_TEMPLATE_ID

  constructor(
    app: App,
    private readonly settings: JournalFolderSettings,
    private readonly onConfirm: (
      name: string,
      templateId: BuiltInTemplateId
    ) => Promise<void>
  ) {
    super(app)
  }

  onOpen(): void {
    this.titleEl.setText('Add new task flow')

    new Setting(this.contentEl)
      .setName('Flow name')
      .setDesc(
        'Must be unique across all flows. Used in front-matter as the ' +
          'value of `task-flow:` on folder configs that want to point at it.'
      )
      .addText((text) => {
        text.setPlaceholder('e.g. Project work').onChange((value) => {
          this.name = value.trim()
        })
      })

    new Setting(this.contentEl)
      .setName('Seed from template')
      .setDesc('Built-in flow used as the starting statuses.')
      .addDropdown((dd) => {
        for (const id of Object.keys(BUILTIN_TEMPLATES) as BuiltInTemplateId[]) {
          dd.addOption(id, BUILTIN_TEMPLATE_LABELS[id])
        }
        dd.setValue(this.templateId).onChange((value) => {
          this.templateId = value as BuiltInTemplateId
        })
      })

    const buttons = this.contentEl.createDiv({
      cls: 'modal-button-container',
    })
    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
      this.close()
    })
    new ButtonComponent(buttons)
      .setButtonText('Create')
      .setCta()
      .onClick(async () => {
        if (!this.name) {
          new Notice('Please enter a flow name.')
          return
        }
        if (this.name in this.settings.taskFlows) {
          new Notice(
            `A flow named "${this.name}" already exists. Pick another name.`
          )
          return
        }
        await this.onConfirm(this.name, this.templateId)
        this.close()
      })
  }
}

class SaveAsFlowModal extends Modal {
  private name = ''

  constructor(
    app: App,
    private readonly settings: JournalFolderSettings,
    private readonly onConfirm: (name: string) => Promise<void>
  ) {
    super(app)
  }

  onOpen(): void {
    this.titleEl.setText('Save flow under a new name')
    new Setting(this.contentEl)
      .setName('New flow name')
      .setDesc('Must be unique across all flows.')
      .addText((text) => {
        text.setPlaceholder('e.g. Project work').onChange((value) => {
          this.name = value.trim()
        })
      })
    const buttons = this.contentEl.createDiv({
      cls: 'modal-button-container',
    })
    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
      this.close()
    })
    new ButtonComponent(buttons)
      .setButtonText('Save')
      .setCta()
      .onClick(async () => {
        if (!this.name) {
          new Notice('Please enter a flow name.')
          return
        }
        if (this.name in this.settings.taskFlows) {
          new Notice(
            `A flow named "${this.name}" already exists. Pick another name.`
          )
          return
        }
        await this.onConfirm(this.name)
        this.close()
      })
  }
}

class ConfirmApplyTemplateModal extends Modal {
  constructor(
    app: App,
    private readonly flowName: string,
    private readonly templateLabel: string,
    private readonly onConfirm: () => Promise<void>
  ) {
    super(app)
  }

  onOpen(): void {
    this.titleEl.setText('Apply template?')
    this.contentEl.createEl('p', {
      text:
        `Applying "${this.templateLabel}" replaces every status in the ` +
        `flow "${this.flowName}". This cannot be undone.`,
    })
    this.contentEl.createEl('p', {
      text:
        'Tip: use "Save flow as new flow…" first if you want to keep ' +
        'the current statuses.',
    })
    const buttons = this.contentEl.createDiv({
      cls: 'modal-button-container',
    })
    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
      this.close()
    })
    new ButtonComponent(buttons)
      .setButtonText('Apply')
      .setCta()
      .onClick(async () => {
        await this.onConfirm()
        this.close()
      })
  }
}

class ConfirmDeleteFlowModal extends Modal {
  constructor(
    app: App,
    private readonly flowName: string,
    private readonly usages: string[],
    private readonly onConfirm: () => Promise<void>
  ) {
    super(app)
  }

  onOpen(): void {
    this.titleEl.setText('Delete flow?')
    this.contentEl.createEl('p', {
      text: `Delete the flow "${this.flowName}"? This cannot be undone.`,
    })
    if (this.usages.length > 0) {
      this.contentEl.createEl('p', {
        cls: 'mod-warning',
        text:
          `${this.usages.length} folder${
            this.usages.length === 1 ? '' : 's'
          } currently use this flow and will revert to the default ` +
          'flow on next render:',
      })
      const list = this.contentEl.createEl('ul')
      for (const folder of this.usages) {
        list.createEl('li', { text: folder })
      }
    }
    const buttons = this.contentEl.createDiv({
      cls: 'modal-button-container',
    })
    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
      this.close()
    })
    new ButtonComponent(buttons)
      .setButtonText('Delete')
      .setWarning()
      .onClick(async () => {
        await this.onConfirm()
        this.close()
      })
  }
}

class ConfirmRemoveStatusModal extends Modal {
  constructor(
    app: App,
    private readonly statusLabel: string,
    private readonly flowName: string,
    private readonly onConfirm: () => Promise<void>
  ) {
    super(app)
  }

  onOpen(): void {
    this.titleEl.setText('Remove status?')
    this.contentEl.createEl('p', {
      text:
        `Remove the status "${this.statusLabel}" from the flow ` +
        `"${this.flowName}"? Existing notes that already use this ` +
        `status character will keep it on disk, but the status will ` +
        `no longer appear in the cycle or the right-click menu.`,
    })
    const buttons = this.contentEl.createDiv({
      cls: 'modal-button-container',
    })
    new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => {
      this.close()
    })
    new ButtonComponent(buttons)
      .setButtonText('Remove')
      .setWarning()
      .onClick(async () => {
        await this.onConfirm()
        this.close()
      })
  }
}

// Suppress lint about unused `isBuiltInTemplate` — preserved as a
// public re-export point for callers that previously imported it
// via this module.
void isBuiltInTemplate
