import { describe, expect, it } from 'vitest'
import { App, TFile, TFolder } from '../mocks/obsidian'
import {
  configPathFor,
  findJournalFolderPaths,
  FOLDER_CONFIG_FILENAME,
  isJournalFolder,
} from '../../src/data-access/journal-folder-detection'

function makeFile(path: string, parent: TFolder | null = null): TFile {
  const file = new TFile()
  file.path = path
  file.name = path.split('/').pop() ?? path
  file.basename = file.name.replace(/\.md$/, '')
  file.extension = 'md'
  file.parent = parent
  return file
}

function setup(): { app: App; addFile: (path: string) => TFile } {
  const app = new App()
  const addFile = (path: string) => {
    const segments = path.split('/')
    const fileName = segments.pop() ?? path
    const parentPath = segments.join('/')
    let parent: TFolder | null = null
    if (parentPath) {
      parent = new TFolder()
      parent.path = parentPath
      parent.name = parentPath.split('/').pop() ?? parentPath
    }
    const file = makeFile(path, parent)
    app.vault.addFile(file)
    return file
  }
  return { app, addFile }
}

describe('findJournalFolderPaths', () => {
  it('returns parent paths of every journal-folder.md, sorted', () => {
    const { app, addFile } = setup()
    addFile('Daily/journal-folder.md')
    addFile('Work/Sub/journal-folder.md')
    addFile('Archive/journal-folder.md')
    addFile('Daily/2026-05-07.md') // not a config note — ignored
    addFile('Inbox/note.md') // unrelated note — ignored

    expect(findJournalFolderPaths(app)).toEqual([
      'Archive',
      'Daily',
      'Work/Sub',
    ])
  })

  it("reports a vault-root config note as '/'", () => {
    const { app, addFile } = setup()
    addFile(FOLDER_CONFIG_FILENAME) // root-level
    expect(findJournalFolderPaths(app)).toEqual(['/'])
  })

  it('returns an empty array when no config notes exist', () => {
    const { app, addFile } = setup()
    addFile('Daily/2026-05-07.md')
    expect(findJournalFolderPaths(app)).toEqual([])
  })
})

describe('isJournalFolder', () => {
  it('is true when the folder contains a journal-folder.md', () => {
    const { app, addFile } = setup()
    addFile('Daily/journal-folder.md')
    expect(isJournalFolder(app, 'Daily')).toBe(true)
  })

  it('is false when the folder lacks a journal-folder.md', () => {
    const { app, addFile } = setup()
    addFile('Daily/2026-05-07.md')
    expect(isJournalFolder(app, 'Daily')).toBe(false)
  })

  it('handles the vault root', () => {
    const { app, addFile } = setup()
    expect(isJournalFolder(app, '')).toBe(false)
    addFile(FOLDER_CONFIG_FILENAME)
    expect(isJournalFolder(app, '')).toBe(true)
    expect(isJournalFolder(app, '/')).toBe(true)
  })
})

describe('configPathFor', () => {
  it('joins folder path and config filename', () => {
    expect(configPathFor('Daily')).toBe('Daily/journal-folder.md')
    expect(configPathFor('Work/Sub')).toBe('Work/Sub/journal-folder.md')
  })

  it("treats '' and '/' as the vault root", () => {
    expect(configPathFor('')).toBe('journal-folder.md')
    expect(configPathFor('/')).toBe('journal-folder.md')
  })
})
