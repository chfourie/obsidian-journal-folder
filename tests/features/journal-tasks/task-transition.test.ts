import { beforeEach, describe, expect, it } from 'vitest'
import { App, Notice, TFile, TFolder } from '../../mocks/obsidian'
import type { JournalTask } from '../../../src/data-access'
import {
  cycleTaskStatus,
  setTaskStatus,
} from '../../../src/features/journal-tasks/task-transition'
import { simpleTaskModel } from '../../../src/features/journal-tasks/task-models'
import { bulletJournalTaskModel } from '../../../src/features/journal-tasks/task-models'

function setup(lines: string[]) {
  Notice.lastMessage = null
  const app = new App()
  const folder = new TFolder()
  folder.path = 'Journal'
  folder.name = 'Journal'
  folder.children = []
  app.vault.addFile(folder)
  const file = new TFile()
  file.basename = '2026-06-03'
  file.name = '2026-06-03.md'
  file.path = 'Journal/2026-06-03.md'
  file.extension = 'md'
  file.parent = folder
  folder.children.push(file)
  app.vault.addFile(file)
  app.vault.setContents(file, lines.join('\n'))
  return { app, file }
}

function task(file: TFile, line: number, status: string): JournalTask {
  return {
    sourceFile: file,
    sourceLine: line,
    rawText: '',
    displayText: '',
    status,
    noteUnit: 'day',
    noteRangeDays: 1,
    noteTitleShort: '',
    noteTitle: '',
    folderPath: 'Journal',
  }
}

describe('setTaskStatus', () => {
  it('flips [ ] to [x] in place', async () => {
    const { app, file } = setup(['- [ ] one', '- [ ] two'])
    await setTaskStatus(app, task(file, 0, 'open'), 'done', simpleTaskModel)
    const updated = await app.vault.read(file)
    expect(updated.split('\n')).toEqual(['- [x] one', '- [ ] two'])
  })

  it('preserves indentation, bullet, and trailing text', async () => {
    const { app, file } = setup(['    * [ ] task with [[link]] suffix'])
    await setTaskStatus(app, task(file, 0, 'open'), 'done', simpleTaskModel)
    const updated = await app.vault.read(file)
    expect(updated).toBe('    * [x] task with [[link]] suffix')
  })

  it('shows a Notice and skips writing when the line no longer matches', async () => {
    const { app, file } = setup(['- [x] already done'])
    await setTaskStatus(app, task(file, 0, 'open'), 'done', simpleTaskModel)
    expect(Notice.lastMessage).toMatch(/no longer/)
    const updated = await app.vault.read(file)
    expect(updated).toBe('- [x] already done')
  })

  it('shows a Notice when the source line index is out of range', async () => {
    const { app, file } = setup(['- [ ] one'])
    await setTaskStatus(app, task(file, 5, 'open'), 'done', simpleTaskModel)
    expect(Notice.lastMessage).toMatch(/no longer/)
  })
})

describe('cycleTaskStatus', () => {
  it('delegates to the active model nextStatus', async () => {
    const { app, file } = setup(['- [/] mid'])
    await cycleTaskStatus(
      app,
      task(file, 0, 'in-progress'),
      bulletJournalTaskModel
    )
    const updated = await app.vault.read(file)
    expect(updated).toBe('- [x] mid')
  })
})

describe('Notice mock', () => {
  beforeEach(() => {
    Notice.lastMessage = null
  })
  it('starts cleared', () => {
    expect(Notice.lastMessage).toBeNull()
  })
})
