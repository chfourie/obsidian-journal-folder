import { beforeEach, describe, expect, it } from 'vitest'
import { App, TFile } from 'obsidian'
import {
  isTemplateableNote,
  resolveNoteTemplate,
} from '../../src/features/journal-auto-template'
import { DEFAULT_AUTO_TEMPLATE } from '../../src/features/journal-auto-template/auto-template-content'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../src/data-access/journal-folder-settings.type'
import { buildFolder } from '../helpers/fixtures'

const GLOBAL_DIR = 'Templates/journal-folder'

function settings(over: Partial<JournalFolderSettings> = {}): JournalFolderSettings {
  return {
    ...DEFAULT_SETTINGS,
    templateFolder: GLOBAL_DIR,
    templateOverrideFolderName: 'Templates',
    ...over,
  }
}

// Adds a journal folder with a `journal-folder.md` config note and returns a
// duck-typed journal-note TFile inside it (not added as an existing child).
function journalNote(app: App, basename: string, configBody = ''): TFile {
  const { folder } = buildFolder(app, 'Journal', [], { folderPath: 'Journal' })
  const config = new TFile()
  config.basename = 'journal-folder'
  config.name = 'journal-folder.md'
  config.path = 'Journal/journal-folder.md'
  config.parent = folder
  folder.children.push(config)
  app.vault.addFile(config)
  // @ts-expect-error — mock vault
  app.vault.setContents(config, configBody)

  const note = new TFile()
  note.basename = basename
  note.name = `${basename}.md`
  note.path = `Journal/${basename}.md`
  note.parent = folder
  return note
}

async function writeTemplate(app: App, path: string, content: string): Promise<void> {
  // @ts-expect-error — mock vault
  await app.vault.create(path, content)
}

describe('isTemplateableNote', () => {
  let app: App
  beforeEach(() => {
    app = new App()
  })

  it('is true for a journal note in a folder with journal-folder.md', () => {
    const note = journalNote(app, '2026-05-07')
    expect(isTemplateableNote(app, note, settings())).toBe(true)
  })

  it('is false for a non-journal basename', () => {
    const note = journalNote(app, 'scratch-note')
    expect(isTemplateableNote(app, note, settings())).toBe(false)
  })

  it('is false when the folder has no journal-folder.md', () => {
    const { folder } = buildFolder(app, 'Plain', [], { folderPath: 'Plain' })
    const note = new TFile()
    note.basename = '2026-05-07'
    note.name = '2026-05-07.md'
    note.path = 'Plain/2026-05-07.md'
    note.parent = folder
    expect(isTemplateableNote(app, note, settings())).toBe(false)
  })

  it('honours quartersEnabled for quarterly basenames', () => {
    const note = journalNote(app, '2026-Q2')
    expect(isTemplateableNote(app, note, settings({ quartersEnabled: false }))).toBe(false)
    expect(isTemplateableNote(app, note, settings({ quartersEnabled: true }))).toBe(true)
  })
})

describe('resolveNoteTemplate', () => {
  let app: App
  beforeEach(() => {
    app = new App()
  })

  it('returns the matching tier file from the global template folder', async () => {
    const note = journalNote(app, '2026-05-07')
    await writeTemplate(app, `${GLOBAL_DIR}/daily-template.md`, '# Daily\n')
    expect(await resolveNoteTemplate(app, note, settings())).toBe('# Daily\n')
  })

  it('prefers a per-folder override file over the global file', async () => {
    const note = journalNote(app, '2026-05')
    await writeTemplate(app, `${GLOBAL_DIR}/monthly-template.md`, '# Global\n')
    await writeTemplate(app, 'Journal/Templates/monthly-template.md', '# Override\n')
    expect(await resolveNoteTemplate(app, note, settings())).toBe('# Override\n')
  })

  it('falls back to the journal-folder.md body then the built-in default', async () => {
    const withBody = journalNote(app, '2026-05-07', '---\nx: 1\n---\n# Body\n')
    expect(await resolveNoteTemplate(app, withBody, settings())).toBe('# Body\n')

    const app2 = new App()
    const bare = journalNote(app2, '2026-05-07')
    expect(await resolveNoteTemplate(app2, bare, settings())).toBe(DEFAULT_AUTO_TEMPLATE)
  })

  it('returns null for a non-journal note', async () => {
    const note = journalNote(app, 'scratch-note')
    expect(await resolveNoteTemplate(app, note, settings())).toBeNull()
  })
})
