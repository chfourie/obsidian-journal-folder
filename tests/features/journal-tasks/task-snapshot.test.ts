import { describe, expect, it } from 'vitest'
import { App, TFile, TFolder } from '../../mocks/obsidian'
import { DEFAULT_SETTINGS, type JournalTask } from '../../../src/data-access'
import {
  capVisibleTasks,
  computeTaskSnapshot,
} from '../../../src/features/journal-tasks/task-snapshot'
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
      { anchor: 'today', range: 'all', folderMode: 'specific', folder: 'Journal', showCompleted: true }
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
      { anchor: 'today', range: 'all', folderMode: 'specific', folder: 'Journal', showCompleted: true }
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
      { anchor: 'today', range: 'all', folderMode: 'all', folder: '', showCompleted: true }
    )
    expect(snapshot.tasks.map((t) => t.displayText)).toEqual(['a task'])
    expect(walkCount()).toBe(1)
  })

  it('filters completed tasks before the cap and counts them across the whole scope', async () => {
    const { app, addNote } = setupApp()
    addNote('2026-06-07', '- [ ] active two\n- [x] done one\n- [x] done two\n')
    const snapshot = await computeTaskSnapshot(
      app,
      { ...DEFAULT_SETTINGS, tasksMaxItems: 1 },
      new TaskCache(app),
      {
        anchor: 'today',
        range: 'all',
        folderMode: 'specific',
        folder: 'Journal',
        showCompleted: false,
      }
    )
    // 2 active in scope, capped to 1 — the cap must not be consumed by
    // hidden completed tasks, and the counts are pre-cap.
    expect(snapshot.tasks).toHaveLength(1)
    expect(snapshot.totalBeforeCap).toBe(2)
    expect(snapshot.truncated).toBe(true)
    expect(snapshot.hiddenCompletedCount).toBe(2)
  })

  it('reports no hidden tasks when completed tasks are shown', async () => {
    const { app, addNote } = setupApp()
    addNote('2026-06-07', '- [x] done one\n')
    const snapshot = await computeTaskSnapshot(
      app,
      DEFAULT_SETTINGS,
      new TaskCache(app),
      {
        anchor: 'today',
        range: 'all',
        folderMode: 'specific',
        folder: 'Journal',
        showCompleted: true,
      }
    )
    expect(snapshot.tasks.map((t) => t.displayText).sort()).toEqual([
      'a task',
      'done one',
    ])
    expect(snapshot.totalBeforeCap).toBe(2)
    expect(snapshot.truncated).toBe(false)
    expect(snapshot.hiddenCompletedCount).toBe(0)
  })
})

describe('capVisibleTasks', () => {
  const model = { isDone: (status: string) => status === 'done' }
  const task = (id: string, status: string): JournalTask =>
    ({ displayText: id, status }) as unknown as JournalTask

  it('caps only the visible tasks and keeps pre-cap totals', () => {
    const sorted = [
      task('a', 'open'),
      task('b', 'done'),
      task('c', 'open'),
      task('d', 'open'),
    ]
    const result = capVisibleTasks(sorted, {
      showCompleted: false,
      model,
      maxItems: 2,
    })
    expect(result.tasks.map((t) => t.displayText)).toEqual(['a', 'c'])
    expect(result.totalBeforeCap).toBe(3)
    expect(result.truncated).toBe(true)
    expect(result.hiddenCompletedCount).toBe(1)
  })

  it('keeps completed tasks and zeroes the hidden count when showing completed', () => {
    const sorted = [task('a', 'open'), task('b', 'done')]
    const result = capVisibleTasks(sorted, {
      showCompleted: true,
      model,
      maxItems: 10,
    })
    expect(result.tasks.map((t) => t.displayText)).toEqual(['a', 'b'])
    expect(result.totalBeforeCap).toBe(2)
    expect(result.truncated).toBe(false)
    expect(result.hiddenCompletedCount).toBe(0)
  })
})
