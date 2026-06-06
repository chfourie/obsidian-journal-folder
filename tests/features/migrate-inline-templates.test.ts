import { describe, expect, it } from 'vitest'
import { App, TFile } from 'obsidian'
import {
  collectMigrationWrites,
  ensureFolderExists,
  runInlineTemplateMigration,
} from '../../src/features/journal-auto-template/migrate-inline-templates'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../src/data-access/journal-folder-settings.type'

function settings(over: Partial<JournalFolderSettings>): JournalFolderSettings {
  return { ...DEFAULT_SETTINGS, ...over }
}

async function read(app: App, path: string): Promise<string | null> {
  const f = app.vault.getAbstractFileByPath(path)
  // @ts-expect-error — mock vault read
  return f instanceof TFile ? app.vault.read(f) : null
}

describe('collectMigrationWrites', () => {
  it('maps the generic template to default.md when per-tier is off', () => {
    expect(
      collectMigrationWrites(
        settings({ autoTemplatePerTier: false, autoTemplateContent: '# Hi\n' })
      )
    ).toEqual([{ filename: 'default-template.md', content: '# Hi\n' }])
  })

  it('maps each non-empty per-tier field to its tier file when per-tier is on', () => {
    const writes = collectMigrationWrites(
      settings({
        autoTemplatePerTier: true,
        dailyNoteAutoTemplateContent: '# D\n',
        monthlyNoteAutoTemplateContent: '# M\n',
        // weekly/quarterly/yearly empty → skipped
      })
    )
    expect(writes).toEqual([
      { filename: 'daily-template.md', content: '# D\n' },
      { filename: 'monthly-template.md', content: '# M\n' },
    ])
  })

  it('ignores the generic field in per-tier mode and vice versa', () => {
    expect(
      collectMigrationWrites(
        settings({
          autoTemplatePerTier: true,
          autoTemplateContent: '# generic\n',
        })
      )
    ).toEqual([])
    expect(
      collectMigrationWrites(
        settings({
          autoTemplatePerTier: false,
          dailyNoteAutoTemplateContent: '# D\n',
        })
      )
    ).toEqual([])
  })

  it('returns nothing when there is no inline content', () => {
    expect(collectMigrationWrites(settings({}))).toEqual([])
  })
})

describe('ensureFolderExists', () => {
  it('creates every missing segment of a nested path', async () => {
    const app = new App()
    await ensureFolderExists(app, 'Templates/journal-folder')
    expect(app.vault.getAbstractFileByPath('Templates')).not.toBeNull()
    expect(
      app.vault.getAbstractFileByPath('Templates/journal-folder')
    ).not.toBeNull()
  })
})

describe('runInlineTemplateMigration', () => {
  it('writes legacy templates into the template folder', async () => {
    const app = new App()
    const written = await runInlineTemplateMigration(
      app,
      settings({
        templateFolder: 'Templates/journal-folder',
        autoTemplatePerTier: true,
        dailyNoteAutoTemplateContent: '# Daily\n',
        yearlyNoteAutoTemplateContent: '# Yearly\n',
      })
    )
    expect(written).toBe(2)
    expect(await read(app, 'Templates/journal-folder/daily-template.md')).toBe(
      '# Daily\n'
    )
    expect(await read(app, 'Templates/journal-folder/yearly-template.md')).toBe(
      '# Yearly\n'
    )
  })

  it('never clobbers an existing template file', async () => {
    const app = new App()
    // @ts-expect-error — seed an existing file via the mock vault
    await app.vault.create('Templates/journal-folder/default-template.md', 'KEEP\n')
    const written = await runInlineTemplateMigration(
      app,
      settings({
        templateFolder: 'Templates/journal-folder',
        autoTemplatePerTier: false,
        autoTemplateContent: '# new\n',
      })
    )
    expect(written).toBe(0)
    expect(await read(app, 'Templates/journal-folder/default-template.md')).toBe(
      'KEEP\n'
    )
  })

  it('does nothing when there is no inline content', async () => {
    const app = new App()
    expect(await runInlineTemplateMigration(app, settings({}))).toBe(0)
  })
})
