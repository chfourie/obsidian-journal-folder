import { beforeEach, describe, expect, it } from 'vitest'
import { App, TFile, TFolder } from '../../mocks/obsidian'
import { processDocumentTasks } from '../../../src/features/journal-tasks/document-tasks-processor'
import {
  buildTaskModel,
  BUILTIN_TEMPLATES,
  cloneTemplate,
  simpleTaskModel,
  type TaskModel,
  type TaskRendering,
} from '../../../src/features/journal-tasks/task-models'
import { bulletJournalTaskModel } from '../../../src/features/journal-tasks/task-models'

// Builds a model from a built-in template with a chosen flow-level
// rendering. Rendering is one-mode-per-flow as of v3 — mixing modes
// inside one nested list paints unreliably across themes.
function modelWith(
  templateKey: keyof typeof BUILTIN_TEMPLATES,
  rendering: TaskRendering
): TaskModel {
  return buildTaskModel(cloneTemplate(BUILTIN_TEMPLATES[templateKey]), rendering)
}

function buildSection(text: string) {
  return {
    text,
    lineStart: 0,
    lineEnd: text.split('\n').length - 1,
  }
}

function buildEl(taskCount: number): HTMLElement {
  const wrapper = document.createElement('ul')
  for (let i = 0; i < taskCount; i++) {
    const li = document.createElement('li')
    li.className = 'task-list-item'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'task-list-item-checkbox'
    li.appendChild(input)
    li.appendChild(document.createTextNode(' task'))
    wrapper.appendChild(li)
  }
  return wrapper
}

function setupApp(text: string) {
  const app = new App()
  const folder = new TFolder()
  folder.path = 'Notes'
  folder.name = 'Notes'
  folder.children = []
  app.vault.addFile(folder)
  const file = new TFile()
  file.basename = 'note'
  file.name = 'note.md'
  file.path = 'Notes/note.md'
  file.extension = 'md'
  file.parent = folder
  folder.children.push(file)
  app.vault.addFile(file)
  app.vault.setContents(file, text)
  return { app, file }
}

describe('processDocumentTasks', () => {
  let calls: { enabled: boolean }
  beforeEach(() => {
    calls = { enabled: true }
  })

  it('does nothing when isEnabled returns false', () => {
    const { app } = setupApp('- [ ] one')
    const el = buildEl(1)
    processDocumentTasks(
      el,
      {
        sourcePath: 'Notes/note.md',
        getSectionInfo: () => buildSection('- [ ] one'),
      } as any,
      {
        app,
        resolveModel: () => simpleTaskModel,
        isEnabled: () => false,
      }
    )
    expect(el.querySelector('input.task-list-item-checkbox')).not.toBeNull()
  })

  it('swaps every plugin-rendered task checkbox for an icon span', () => {
    const text = ['- [ ] one', '- [x] two'].join('\n')
    const { app } = setupApp(text)
    const el = buildEl(2)
    processDocumentTasks(
      el,
      {
        sourcePath: 'Notes/note.md',
        getSectionInfo: () => buildSection(text),
      } as any,
      {
        app,
        resolveModel: () => simpleTaskModel,
        isEnabled: () => true,
      }
    )
    const icons = el.querySelectorAll('.jf-task-status')
    expect(icons.length).toBe(2)
    // The native checkbox is kept in flow (so the theme positions it) but
    // hidden and non-interactive; the icon is overlaid on top of it.
    const inputs = el.querySelectorAll<HTMLInputElement>(
      'input.task-list-item-checkbox'
    )
    expect(inputs.length).toBe(2)
    inputs.forEach((input) => {
      expect(input.getAttribute('aria-hidden')).toBe('true')
      expect(input.style.opacity).toBe('0')
      expect(input.style.pointerEvents).toBe('none')
    })
  })

  it('mirrors the status char onto the parent li data-task', () => {
    const text = '- [/] mid'
    const { app } = setupApp(text)
    const el = buildEl(1)
    processDocumentTasks(
      el,
      {
        sourcePath: 'Notes/note.md',
        getSectionInfo: () => buildSection(text),
      } as any,
      {
        app,
        resolveModel: () => bulletJournalTaskModel,
        isEnabled: () => true,
      }
    )
    const li = el.querySelector('li.task-list-item')
    expect(li?.getAttribute('data-task')).toBe('/')
  })

  it('theme-rendered statuses leave the native checkbox in place', () => {
    const text = '- [ ] one'
    const { app } = setupApp(text)
    const el = buildEl(1)
    processDocumentTasks(
      el,
      {
        sourcePath: 'Notes/note.md',
        getSectionInfo: () => buildSection(text),
      } as any,
      {
        app,
        resolveModel: () => modelWith('simple', 'theme'),
        isEnabled: () => true,
      }
    )
    expect(el.querySelector('input.task-list-item-checkbox')).not.toBeNull()
    expect(el.querySelector('.jf-task-status')).toBeNull()
  })

  it('theme-rendered statuses still mirror data-task onto the parent li', () => {
    const text = '- [/] mid'
    const { app } = setupApp(text)
    const el = buildEl(1)
    processDocumentTasks(
      el,
      {
        sourcePath: 'Notes/note.md',
        getSectionInfo: () => buildSection(text),
      } as any,
      {
        app,
        resolveModel: () => modelWith('bullet-journal', 'theme'),
        isEnabled: () => true,
      }
    )
    expect(
      el.querySelector('li.task-list-item')?.getAttribute('data-task')
    ).toBe('/')
  })

  it('theme-rendered left-click on the native checkbox writes the next status', async () => {
    const text = '- [ ] one'
    const { app, file } = setupApp(text)
    const el = buildEl(1)
    processDocumentTasks(
      el,
      {
        sourcePath: 'Notes/note.md',
        getSectionInfo: () => buildSection(text),
      } as any,
      {
        app,
        resolveModel: () => modelWith('simple', 'theme'),
        isEnabled: () => true,
      }
    )
    const input = el.querySelector(
      'input.task-list-item-checkbox'
    ) as HTMLInputElement
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(await app.vault.read(file)).toBe('- [x] one')
  })

  it('left-clicking the icon writes the next status to disk', async () => {
    const text = '- [ ] one'
    const { app, file } = setupApp(text)
    const el = buildEl(1)
    processDocumentTasks(
      el,
      {
        sourcePath: 'Notes/note.md',
        getSectionInfo: () => buildSection(text),
      } as any,
      {
        app,
        resolveModel: () => simpleTaskModel,
        isEnabled: () => true,
      }
    )
    const icon = el.querySelector('.jf-task-status') as HTMLElement
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(await app.vault.read(file)).toBe('- [x] one')
  })

})
