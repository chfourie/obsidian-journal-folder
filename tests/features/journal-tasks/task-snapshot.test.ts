import { describe, expect, it } from 'vitest'
import { App, TFile, TFolder } from '../../mocks/obsidian'
import { DEFAULT_SETTINGS } from '../../../src/data-access'
import { computeTaskSnapshot } from '../../../src/features/journal-tasks/task-snapshot'
import { TaskCache } from '../../../src/features/journal-tasks/task-cache'

// A vault with one journal folder (config note + a daily note carrying a
// task), instrumented so tests can count full-vault walks: every call to
// `vault.getMarkdownFiles()` — the cost behind `findJournalFolderPaths` —
// increments the counter.
function setupApp(): {
  app: App
  walkCount: () => number
  addNote: (basename: string, content: string) => void
} {
  const app = new App()
  const folder = new TFolder()
  folder.path = 'Journal'
  folder.name = 'Journal'
  app.vault.addFile(folder)
  const addNote = (basename: string, content: string) => {
    const file = new TFile()
    file.basename = basename
    file.name = `${basename}.md`
    file.path = `Journal/${basename}.md`
    file.extension = 'md'
    file.parent = folder
    folder.children.push(file)
    app.vault.addFile(file)
    app.vault.setContents(file, content)
  }
  addNote('journal-folder', '')
  addNote('2026-06-08', '- [ ] a task\n')

  let count = 0
  const original = app.vault.getMarkdownFiles.bind(app.vault)
  app.vault.getMarkdownFiles = () => {
    count += 1
    return original()
  }
  return { app, walkCount: () => count, addNote }
}

describe('computeTaskSnapshot', () => {
  it('skips the full-vault folder walk when the folder mode names its folder directly', async () => {
    const { app, walkCount } = setupApp()
    const snapshot = await computeTaskSnapshot(
      app,
      DEFAULT_SETTINGS,
      new TaskCache(app),
      { anchor: 'today', range: 'all', folderMode: 'specific', folder: 'Journal' }
    )
    expect(snapshot.tasks.map((t) => t.displayText)).toEqual(['a task'])
    expect(walkCount()).toBe(0)
  })

  it('collects every candidate note through the pooled cache reads', async () => {
    // The cold-cache reads now run through `mapWithConcurrency` — every
    // candidate must still be loaded and contribute its tasks.
    const { app, addNote } = setupApp()
    for (const day of ['2026-06-05', '2026-06-06', '2026-06-07']) {
      addNote(day, `- [ ] task ${day}\n`)
    }
    const snapshot = await computeTaskSnapshot(
      app,
      DEFAULT_SETTINGS,
      new TaskCache(app),
      { anchor: 'today', range: 'all', folderMode: 'specific', folder: 'Journal' }
    )
    expect(snapshot.tasks.map((t) => t.displayText).sort()).toEqual([
      'a task',
      'task 2026-06-05',
      'task 2026-06-06',
      'task 2026-06-07',
    ])
  })

  it('walks the vault for journal folders only in all-folders mode', async () => {
    const { app, walkCount } = setupApp()
    const snapshot = await computeTaskSnapshot(
      app,
      DEFAULT_SETTINGS,
      new TaskCache(app),
      { anchor: 'today', range: 'all', folderMode: 'all', folder: '' }
    )
    expect(snapshot.tasks.map((t) => t.displayText)).toEqual(['a task'])
    expect(walkCount()).toBe(1)
  })
})
