import { beforeEach, describe, expect, it } from 'vitest'
import { App, TFile, TFolder } from '../../mocks/obsidian'
import { processDocumentTasks } from '../../../src/features/journal-tasks/document-tasks-processor'
import { simpleTaskModel } from '../../../src/features/journal-tasks/task-models/simple-model'
import { bulletJournalTaskModel } from '../../../src/features/journal-tasks/task-models/bullet-journal-model'

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
        resolveCheckboxStyle: () => 'square',
        resolveRendering: () => 'plugin',
        isEnabled: () => false,
      }
    )
    expect(el.querySelector('input.task-list-item-checkbox')).not.toBeNull()
  })

  it('swaps every task checkbox for an icon span', () => {
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
        resolveCheckboxStyle: () => 'square',
        resolveRendering: () => 'plugin',
        isEnabled: () => true,
      }
    )
    const icons = el.querySelectorAll('.journal-folder-document-task-icon')
    expect(icons.length).toBe(2)
    expect(el.querySelector('input.task-list-item-checkbox')).toBeNull()
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
        resolveCheckboxStyle: () => 'square',
        resolveRendering: () => 'plugin',
        isEnabled: () => true,
      }
    )
    const li = el.querySelector('li.task-list-item')
    expect(li?.getAttribute('data-task')).toBe('/')
  })

  it('theme mode leaves the native checkbox in place', () => {
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
        resolveModel: () => simpleTaskModel,
        resolveCheckboxStyle: () => 'square',
        resolveRendering: () => 'theme',
        isEnabled: () => true,
      }
    )
    expect(el.querySelector('input.task-list-item-checkbox')).not.toBeNull()
    expect(
      el.querySelector('.journal-folder-document-task-icon')
    ).toBeNull()
  })

  it('theme mode still mirrors data-task onto the parent li', () => {
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
        resolveCheckboxStyle: () => 'square',
        resolveRendering: () => 'theme',
        isEnabled: () => true,
      }
    )
    expect(
      el.querySelector('li.task-list-item')?.getAttribute('data-task')
    ).toBe('/')
  })

  it('theme mode left-click on the native checkbox writes the next status', async () => {
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
        resolveCheckboxStyle: () => 'square',
        resolveRendering: () => 'theme',
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
        resolveCheckboxStyle: () => 'square',
        resolveRendering: () => 'plugin',
        isEnabled: () => true,
      }
    )
    const icon = el.querySelector(
      '.journal-folder-document-task-icon'
    ) as HTMLElement
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // The click handler awaits an async write internally; let microtasks flush.
    await Promise.resolve()
    await Promise.resolve()
    expect(await app.vault.read(file)).toBe('- [x] one')
  })
})
