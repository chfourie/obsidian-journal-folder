import { describe, expect, it } from 'vitest'
import { App, Plugin, TFile, TFolder } from 'obsidian'
import { FolderSettingsResolver } from '../../src/data-access/folder-settings-resolver'
import { DEFAULT_SETTINGS } from '../../src/data-access/journal-folder-settings.type'
import { buildApp } from '../helpers/fixtures'

function makePlugin(app: App): Plugin {
  return new Plugin(app, {
    id: 'test',
    name: 'Test',
    version: '0.0.0',
    minAppVersion: '0.0.0',
    description: '',
    author: '',
  })
}

describe('FolderSettingsResolver', () => {
  describe('resolve()', () => {
    it('returns the global settings when no file or embedded config is given', () => {
      const app = new App()
      const resolver = new FolderSettingsResolver(makePlugin(app))

      expect(resolver.resolve(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
    })

    it('overlays folder front-matter onto global settings', () => {
      const { app, files } = buildApp('Journal', [
        '2026-05-03',
        {
          name: 'journal-folder.md',
          frontmatter: { 'journal-folder-title': 'My Journal' },
        },
      ])
      const resolver = new FolderSettingsResolver(makePlugin(app))

      const resolved = resolver.resolve(DEFAULT_SETTINGS, files['2026-05-03'])

      expect(resolved.journalFolderTitle).toBe('My Journal')
    })

    it('converts front-matter keys to camelCase', () => {
      const { app, files } = buildApp('Journal', [
        '2026-05-03',
        {
          name: 'journal-folder.md',
          frontmatter: {
            'daily-note-title-pattern': 'DD MMM',
            JOURNAL_FOLDER_TITLE: 'Loud Title',
          },
        },
      ])
      const resolver = new FolderSettingsResolver(makePlugin(app))

      const resolved = resolver.resolve(DEFAULT_SETTINGS, files['2026-05-03'])

      expect(resolved.dailyNoteTitlePattern).toBe('DD MMM')
      expect(resolved.journalFolderTitle).toBe('Loud Title')
    })

    it('overlays embedded config on top of folder + global settings', () => {
      const { app, files } = buildApp('Journal', [
        '2026-05-03',
        {
          name: 'journal-folder.md',
          frontmatter: { 'journal-folder-title': 'Folder Title' },
        },
      ])
      const resolver = new FolderSettingsResolver(makePlugin(app))

      const resolved = resolver.resolve(
        DEFAULT_SETTINGS,
        files['2026-05-03'],
        'journal-folder-title: Embedded Title'
      )

      expect(resolved.journalFolderTitle).toBe('Embedded Title')
    })

    it('parses multi-line embedded config', () => {
      const app = new App()
      const { files } = buildApp('Journal', ['2026-05-03'])
      const resolver = new FolderSettingsResolver(makePlugin(app))

      const resolved = resolver.resolve(
        DEFAULT_SETTINGS,
        files['2026-05-03'],
        `
        journal-folder-title: Two
        DAILY_NOTE_TITLE_PATTERN: dddd
        `
      )

      expect(resolved.journalFolderTitle).toBe('Two')
      expect(resolved.dailyNoteTitlePattern).toBe('dddd')
    })

    it('ignores blank lines and lines without a colon in embedded config', () => {
      const { app, files } = buildApp('Journal', ['2026-05-03'])
      const resolver = new FolderSettingsResolver(makePlugin(app))

      const resolved = resolver.resolve(
        DEFAULT_SETTINGS,
        files['2026-05-03'],
        `
        # this is a comment without a colon
        journal-folder-title: Valid

        garbage line
        `
      )

      expect(resolved.journalFolderTitle).toBe('Valid')
    })

    it('preserves values containing colons after the first separator', () => {
      const { app, files } = buildApp('Journal', ['2026-05-03'])
      const resolver = new FolderSettingsResolver(makePlugin(app))

      const resolved = resolver.resolve(
        DEFAULT_SETTINGS,
        files['2026-05-03'],
        'daily-note-title-pattern: HH:mm:ss'
      )

      expect(resolved.dailyNoteTitlePattern).toBe('HH:mm:ss')
    })

    it('returns global settings when journal-folder.md is missing from the folder', () => {
      const { app, files } = buildApp('Journal', ['2026-05-03'])
      const resolver = new FolderSettingsResolver(makePlugin(app))

      expect(resolver.resolve(DEFAULT_SETTINGS, files['2026-05-03'])).toEqual(
        DEFAULT_SETTINGS
      )
    })

    it('does not bleed settings between sibling folders with the same name', () => {
      const app = new App()

      // /Outer/Journal/journal-folder.md → "Outer Journal"
      const outerJournal = new TFolder()
      outerJournal.name = 'Journal'
      outerJournal.path = 'Outer/Journal'
      const outerConfig = new TFile()
      outerConfig.basename = 'journal-folder'
      outerConfig.name = 'journal-folder.md'
      outerConfig.path = 'Outer/Journal/journal-folder.md'
      outerConfig.parent = outerJournal
      app.vault.addFile(outerConfig)
      app.metadataCache.setFrontmatter(outerConfig, {
        'journal-folder-title': 'Outer Journal',
      })

      // /Inner/Journal/2026-05-03.md (no journal-folder.md present)
      const innerJournal = new TFolder()
      innerJournal.name = 'Journal'
      innerJournal.path = 'Inner/Journal'
      const innerNote = new TFile()
      innerNote.basename = '2026-05-03'
      innerNote.name = '2026-05-03.md'
      innerNote.path = 'Inner/Journal/2026-05-03.md'
      innerNote.parent = innerJournal
      app.vault.addFile(innerNote)

      const resolver = new FolderSettingsResolver(makePlugin(app))
      const resolved = resolver.resolve(DEFAULT_SETTINGS, innerNote)

      // Outer/Journal's title must NOT bleed into the unrelated Inner/Journal note.
      expect(resolved.journalFolderTitle).toBe(DEFAULT_SETTINGS.journalFolderTitle)
    })
  })
})
