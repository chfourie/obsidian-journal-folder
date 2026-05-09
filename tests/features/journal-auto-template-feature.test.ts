import { beforeEach, describe, expect, it } from 'vitest'
import { App, Plugin, TFile, type PluginManifest } from 'obsidian'
import { JournalAutoTemplateFeature } from '../../src/features/journal-auto-template'
import { DEFAULT_AUTO_TEMPLATE } from '../../src/features/journal-auto-template/auto-template-content'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
} from '../../src/data-access/journal-folder-settings.type'
import { buildFolder } from '../helpers/fixtures'

const MANIFEST: PluginManifest = {
  id: 'journal-folder',
  name: 'Journal Folder',
  version: '0.0.0',
  minAppVersion: '0.0.0',
  description: '',
  author: '',
}

function buildPlugin(): Plugin {
  return new Plugin(new App(), MANIFEST)
}

async function createFile(
  app: App,
  folderPath: string,
  name: string,
  initialContent = ''
): Promise<TFile> {
  const file = new TFile()
  file.basename = name.replace(/\.md$/, '')
  file.name = name.endsWith('.md') ? name : `${name}.md`
  file.path = `${folderPath}/${file.name}`
  // @ts-expect-error — test mock vault
  const folder = app.vault.getAbstractFileByPath(folderPath)
  // @ts-expect-error
  file.parent = folder
  app.vault.addFile(file)
  // @ts-expect-error
  app.vault.setContents(file, initialContent)
  // @ts-expect-error
  app.vault.trigger('create', file)
  // Allow the async handler to complete.
  await new Promise((r) => setTimeout(r, 0))
  return file
}

function setupFeature(
  settings: Partial<JournalFolderSettings> = {}
): { app: App; plugin: Plugin } {
  const plugin = buildPlugin()
  const feature = new JournalAutoTemplateFeature(plugin)
  feature.useSettings({ ...DEFAULT_SETTINGS, ...settings })
  // noinspection JSIgnoredPromiseFromCall
  feature.load()
  // @ts-expect-error — test mock workspace
  plugin.app.workspace.signalLayoutReady()
  return { app: plugin.app, plugin }
}

function seedJournalFolder(
  app: App,
  folderName = 'Journal',
  configBody = '',
  configFrontmatter?: Record<string, unknown>
): void {
  const { folder } = buildFolder(app, folderName, [], { folderPath: folderName })
  const config = new TFile()
  config.basename = 'journal-folder'
  config.name = 'journal-folder.md'
  config.path = `${folder.path}/journal-folder.md`
  config.parent = folder
  folder.children.push(config)
  app.vault.addFile(config)
  // @ts-expect-error
  app.vault.setContents(config, configBody)
  if (configFrontmatter) app.metadataCache.setFrontmatter(config, configFrontmatter)
}

describe('JournalAutoTemplateFeature', () => {
  let app: App
  beforeEach(() => {
    // fresh app per test happens inside each setupFeature call
  })

  it('seeds new daily notes with the built-in default when enabled', async () => {
    ;({ app } = setupFeature({ autoTemplateEnabled: true }))
    seedJournalFolder(app)

    const file = await createFile(app, 'Journal', '2026-05-07')

    // @ts-expect-error
    expect(await app.vault.read(file)).toBe(DEFAULT_AUTO_TEMPLATE)
  })

  it('uses per-tier templates when autoTemplatePerTier is on, ignoring the generic template', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      autoTemplatePerTier: true,
      autoTemplateContent: '# Generic\n',
      dailyNoteAutoTemplateContent: '# Daily\n',
      weeklyNoteAutoTemplateContent: '# Weekly\n',
    }))
    seedJournalFolder(app)

    const daily = await createFile(app, 'Journal', '2026-05-07')
    const weekly = await createFile(app, 'Journal', '2026-W19')
    const monthly = await createFile(app, 'Journal', '2026-05')
    // @ts-expect-error
    expect(await app.vault.read(daily)).toBe('# Daily\n')
    // @ts-expect-error
    expect(await app.vault.read(weekly)).toBe('# Weekly\n')
    // monthly has no per-tier override → falls through to the built-in
    // default (the generic template is ignored in per-tier mode).
    // @ts-expect-error
    expect(await app.vault.read(monthly)).toBe(DEFAULT_AUTO_TEMPLATE)
  })

  it('ignores per-tier fields when autoTemplatePerTier is off', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      autoTemplatePerTier: false,
      autoTemplateContent: '# Generic\n',
      dailyNoteAutoTemplateContent: '# Daily\n',
    }))
    seedJournalFolder(app)

    const daily = await createFile(app, 'Journal', '2026-05-07')
    // @ts-expect-error
    expect(await app.vault.read(daily)).toBe('# Generic\n')
  })

  it('uses the global template content when set', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      autoTemplateContent: '# Hello\n',
    }))
    seedJournalFolder(app)

    const file = await createFile(app, 'Journal', '2026-05-07')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('# Hello\n')
  })

  it('prefers the per-folder body of journal-folder.md over the global setting', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      autoTemplateContent: '# Global\n',
    }))
    seedJournalFolder(app, 'Journal', '---\nfoo: bar\n---\n# Folder body\n')

    const file = await createFile(app, 'Journal', '2026-05-07')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('# Folder body\n')
  })

  it('does nothing when there is no journal-folder.md in the folder', async () => {
    ;({ app } = setupFeature({ autoTemplateEnabled: true }))
    // Build the folder but skip adding journal-folder.md.
    buildFolder(app, 'NotAJournal', [], { folderPath: 'NotAJournal' })

    const file = await createFile(app, 'NotAJournal', '2026-05-07')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('')
  })

  it('does nothing when the global setting is disabled', async () => {
    ;({ app } = setupFeature({ autoTemplateEnabled: false }))
    seedJournalFolder(app)

    const file = await createFile(app, 'Journal', '2026-05-07')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('')
  })

  it('honours per-folder disable via journal-folder.md front-matter', async () => {
    ;({ app } = setupFeature({ autoTemplateEnabled: true }))
    seedJournalFolder(app, 'Journal', '', { 'auto-template-enabled': false })

    const file = await createFile(app, 'Journal', '2026-05-07')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('')
  })

  it('skips files whose basename is not a journal pattern', async () => {
    ;({ app } = setupFeature({ autoTemplateEnabled: true }))
    seedJournalFolder(app)

    const file = await createFile(app, 'Journal', 'random-note')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('')
  })

  it('skips quarterly basenames unless quarters are enabled', async () => {
    ;({ app } = setupFeature({ autoTemplateEnabled: true, quartersEnabled: false }))
    seedJournalFolder(app)

    const file = await createFile(app, 'Journal', '2026-Q2')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('')
  })

  it('seeds quarterly notes when quarters are enabled', async () => {
    ;({ app } = setupFeature({ autoTemplateEnabled: true, quartersEnabled: true }))
    seedJournalFolder(app)

    const file = await createFile(app, 'Journal', '2026-Q2')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe(DEFAULT_AUTO_TEMPLATE)
  })

  it('does not overwrite a file that already has content', async () => {
    ;({ app } = setupFeature({ autoTemplateEnabled: true }))
    seedJournalFolder(app)

    const file = await createFile(app, 'Journal', '2026-05-07', 'pre-existing\n')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('pre-existing\n')
  })

  it('does not seed the journal-folder.md config note itself', async () => {
    ;({ app } = setupFeature({ autoTemplateEnabled: true }))
    seedJournalFolder(app)
    // The seed helper already added journal-folder.md without firing a
    // create event. Simulate a create now and ensure it stays untouched.
    // @ts-expect-error
    const config = app.vault.getAbstractFileByPath('Journal/journal-folder.md')
    // @ts-expect-error
    app.vault.trigger('create', config)
    await new Promise((r) => setTimeout(r, 0))
    // @ts-expect-error
    expect(await app.vault.read(config)).toBe('')
  })
})
