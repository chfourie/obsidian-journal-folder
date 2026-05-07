import { describe, expect, it } from 'vitest'
import { App, TFile, TFolder } from '../mocks/obsidian'
import {
  buildDefaultJournalFolderConfig,
  findInitialisableFolders,
  initialiseJournalFolder,
} from '../../src/features/journal-folder-sidebar/init-journal-folder'

function setup() {
  const app = new App()
  const addFolder = (path: string) => {
    const folder = new TFolder()
    folder.path = path
    folder.name = path.split('/').pop() ?? path
    app.vault.addFile(folder)
    return folder
  }
  const addFile = (path: string) => {
    const file = new TFile()
    file.path = path
    file.name = path.split('/').pop() ?? path
    file.basename = file.name.replace(/\.md$/, '')
    file.extension = 'md'
    const parentPath = path.includes('/')
      ? path.slice(0, path.lastIndexOf('/'))
      : ''
    file.parent = parentPath
      ? (app.vault.getAbstractFileByPath(parentPath) as TFolder | null)
      : null
    app.vault.addFile(file)
    return file
  }
  return { app, addFolder, addFile }
}

describe('findInitialisableFolders', () => {
  it('returns folders that are not already journal folders, sorted', () => {
    const { app, addFolder, addFile } = setup()
    addFolder('Daily')
    addFile('Daily/journal-folder.md') // Daily is a journal folder
    addFolder('Inbox')
    addFolder('Archive')
    addFolder('Work/Sub')

    const result = findInitialisableFolders(app).map((f) => f.path)
    expect(result).toEqual(['Archive', 'Inbox', 'Work/Sub'])
  })

  it('excludes the vault root', () => {
    const { app, addFolder } = setup()
    const root = addFolder('')
    // simulate isRoot
    expect(root.isRoot()).toBe(true)
    addFolder('Inbox')
    expect(findInitialisableFolders(app).map((f) => f.path)).toEqual(['Inbox'])
  })

  it('returns empty when every non-root folder already has a config note', () => {
    const { app, addFolder, addFile } = setup()
    addFolder('Daily')
    addFile('Daily/journal-folder.md')
    addFolder('Work')
    addFile('Work/journal-folder.md')

    expect(findInitialisableFolders(app)).toEqual([])
  })
})

describe('buildDefaultJournalFolderConfig', () => {
  it('seeds journal-folder-title with the folder name', () => {
    expect(buildDefaultJournalFolderConfig('Atlas')).toBe(
      '---\njournal-folder-title: Atlas\n---\n'
    )
  })
})

describe('initialiseJournalFolder', () => {
  it('creates journal-folder.md in the target folder with default config', async () => {
    const { app, addFolder } = setup()
    const folder = addFolder('Inbox')
    const file = await initialiseJournalFolder(app, folder)
    expect(file.path).toBe('Inbox/journal-folder.md')
    expect(await app.vault.read(file)).toBe(
      '---\njournal-folder-title: Inbox\n---\n'
    )
  })

  it('returns the existing file when the folder is already initialised', async () => {
    const { app, addFolder, addFile } = setup()
    const folder = addFolder('Daily')
    const existing = addFile('Daily/journal-folder.md')
    const result = await initialiseJournalFolder(app, folder)
    expect(result).toBe(existing)
  })
})
