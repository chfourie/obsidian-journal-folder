import { beforeEach, describe, expect, it } from 'vitest'
import { App, TFile, TFolder } from '../../mocks/obsidian'
import {
  DEFAULT_SETTINGS,
  journalNoteFactoryWithSettings,
} from '../../../src/data-access'
import { TaskCache } from '../../../src/features/journal-tasks/task-cache'
import { simpleTaskModel } from '../../../src/features/journal-tasks/task-models'
import { bulletJournalTaskModel } from '../../../src/features/journal-tasks/task-models'

function setup() {
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
  file.stat = { ctime: 0, mtime: 100, size: 0 }
  folder.children.push(file)
  app.vault.addFile(file)
  app.vault.setContents(file, '- [ ] task one')
  const note = journalNoteFactoryWithSettings(DEFAULT_SETTINGS)(file)
  return { app, file, note }
}

describe('TaskCache', () => {
  let env: ReturnType<typeof setup>
  beforeEach(() => {
    env = setup()
  })

  it('returns the same array on a cache hit', async () => {
    const cache = new TaskCache(env.app)
    const first = await cache.getTasks(env.file, simpleTaskModel, env.note)
    const second = await cache.getTasks(env.file, simpleTaskModel, env.note)
    expect(second).toBe(first)
  })

  it('reparses when mtime changes', async () => {
    const cache = new TaskCache(env.app)
    const first = await cache.getTasks(env.file, simpleTaskModel, env.note)
    env.file.stat = { ctime: 0, mtime: 200, size: 0 }
    env.app.vault.setContents(env.file, '- [x] one\n- [ ] two')
    const second = await cache.getTasks(env.file, simpleTaskModel, env.note)
    expect(second).not.toBe(first)
    expect(second.map((t) => t.displayText)).toEqual(['one', 'two'])
  })

  it('reparses when the active model changes', async () => {
    const cache = new TaskCache(env.app)
    const first = await cache.getTasks(env.file, simpleTaskModel, env.note)
    const second = await cache.getTasks(
      env.file,
      bulletJournalTaskModel,
      env.note
    )
    expect(second).not.toBe(first)
  })

  it('invalidate removes the entry', async () => {
    const cache = new TaskCache(env.app)
    const first = await cache.getTasks(env.file, simpleTaskModel, env.note)
    cache.invalidate(env.file.path)
    const second = await cache.getTasks(env.file, simpleTaskModel, env.note)
    expect(second).not.toBe(first)
  })

  it('rename moves the entry to the new path', async () => {
    const cache = new TaskCache(env.app)
    await cache.getTasks(env.file, simpleTaskModel, env.note)
    cache.rename(env.file.path, 'Journal/renamed.md')
    // After rename(), looking up by new path with the same mtime should hit.
    const renamedFile = Object.assign(new TFile(), env.file, {
      path: 'Journal/renamed.md',
    })
    const cached = await cache.getTasks(renamedFile, simpleTaskModel, env.note)
    expect(cached.length).toBe(1)
  })

  it('clear empties the cache', async () => {
    const cache = new TaskCache(env.app)
    const first = await cache.getTasks(env.file, simpleTaskModel, env.note)
    cache.clear()
    const second = await cache.getTasks(env.file, simpleTaskModel, env.note)
    expect(second).not.toBe(first)
  })
})
