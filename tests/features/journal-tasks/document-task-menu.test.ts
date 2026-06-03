import { describe, expect, it } from 'vitest'
import { App, Menu, TFile } from '../../mocks/obsidian'
import { appendStatusMenuItems } from '../../../src/features/journal-tasks/document-task-menu'
import { bulletJournalTaskModel } from '../../../src/features/journal-tasks/task-models'
import { simpleTaskModel } from '../../../src/features/journal-tasks/task-models'

describe('appendStatusMenuItems', () => {
  it('adds one entry per status in display order', () => {
    const menu = new Menu()
    const file = new TFile()
    file.path = 'note.md'
    appendStatusMenuItems(
      menu,
      { sourceFile: file, sourceLine: 0, status: 'open' },
      bulletJournalTaskModel,
      new App()
    )
    const titles = (menu.items as Array<{ title?: string }>).map(
      (i) => i.title
    )
    expect(titles).toEqual([
      'Open',
      'In progress',
      'Done',
      'Migrated',
      'Cancelled',
      'Delegated',
    ])
  })

  it('marks the current status with a check icon', () => {
    const menu = new Menu()
    const file = new TFile()
    file.path = 'note.md'
    appendStatusMenuItems(
      menu,
      { sourceFile: file, sourceLine: 0, status: 'done' },
      simpleTaskModel,
      new App()
    )
    const items = menu.items as Array<{ title: string; icon?: string }>
    expect(items.find((i) => i.title === 'Done')?.icon).toBe('check')
    expect(items.find((i) => i.title === 'Open')?.icon).toBeUndefined()
  })

  it('clicking an item writes the chosen status through vault.process', async () => {
    const app = new App()
    const file = await app.vault.create('note.md', '- [ ] one')
    const menu = new Menu()
    appendStatusMenuItems(
      menu,
      { sourceFile: file, sourceLine: 0, status: 'open' },
      simpleTaskModel,
      app
    )
    const items = menu.items as Array<{ title: string; click?: () => void }>
    items.find((i) => i.title === 'Done')!.click!()
    // Click handler kicks off an async write; flush microtasks.
    await Promise.resolve()
    await Promise.resolve()
    expect(await app.vault.read(file)).toBe('- [x] one')
  })
})
