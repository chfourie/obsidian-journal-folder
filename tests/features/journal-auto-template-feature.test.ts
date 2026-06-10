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
  const feature = new JournalAutoTemplateFeature(plugin, async (next) => {
    feature.useSettings(next)
  })
  feature.useSettings({ ...DEFAULT_SETTINGS, ...settings })
  // noinspection JSIgnoredPromiseFromCall
  feature.load()
  // @ts-expect-error — test mock workspace
  plugin.app.workspace.signalLayoutReady()
  return { app: plugin.app, plugin }
}

// Writes a template note straight into the mock vault (bypassing the create
// listener, which would ignore it — template files aren't journal basenames).
async function writeNote(
  app: App,
  path: string,
  content: string
): Promise<void> {
  // @ts-expect-error — test mock vault
  await app.vault.create(path, content)
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

  it('seeds from the matching tier file in the global template folder', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      templateFolder: 'Templates/journal-folder',
    }))
    seedJournalFolder(app)
    await writeNote(app, 'Templates/journal-folder/daily-template.md', '# Daily file\n')
    await writeNote(app, 'Templates/journal-folder/monthly-template.md', '# Monthly\n')

    const daily = await createFile(app, 'Journal', '2026-05-07')
    const monthly = await createFile(app, 'Journal', '2026-05')
    // @ts-expect-error
    expect(await app.vault.read(daily)).toBe('# Daily file\n')
    // @ts-expect-error
    expect(await app.vault.read(monthly)).toBe('# Monthly\n')
  })

  it('falls back to default-template.md for a tier with no dedicated file', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      templateFolder: 'Templates/journal-folder',
    }))
    seedJournalFolder(app)
    await writeNote(app, 'Templates/journal-folder/default-template.md', '# Fallback\n')

    const weekly = await createFile(app, 'Journal', '2026-W19')
    // @ts-expect-error
    expect(await app.vault.read(weekly)).toBe('# Fallback\n')
  })

  it('keeps front matter in template files verbatim', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      templateFolder: 'Templates/journal-folder',
    }))
    seedJournalFolder(app)
    await writeNote(
      app,
      'Templates/journal-folder/daily-template.md',
      '---\ntags: [journal]\n---\n# Daily\n'
    )

    const daily = await createFile(app, 'Journal', '2026-05-07')
    // @ts-expect-error
    expect(await app.vault.read(daily)).toBe('---\ntags: [journal]\n---\n# Daily\n')
  })

  it('lets a per-folder override file beat the global template file', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      templateFolder: 'Templates/journal-folder',
      templateOverrideFolderName: 'Templates',
    }))
    seedJournalFolder(app)
    await writeNote(app, 'Templates/journal-folder/monthly-template.md', '# Global\n')
    await writeNote(app, 'Journal/Templates/monthly-template.md', '# Override\n')

    const monthly = await createFile(app, 'Journal', '2026-05')
    // @ts-expect-error
    expect(await app.vault.read(monthly)).toBe('# Override\n')
  })

  it('prefers the journal-folder.md body over the global template file (legacy)', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      templateFolder: 'Templates/journal-folder',
    }))
    seedJournalFolder(app, 'Journal', '---\nfoo: bar\n---\n# Folder body\n')
    await writeNote(app, 'Templates/journal-folder/daily-template.md', '# Global\n')

    const file = await createFile(app, 'Journal', '2026-05-07')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('# Folder body\n')
  })

  it('lets an override file beat the journal-folder.md body', async () => {
    ;({ app } = setupFeature({
      autoTemplateEnabled: true,
      templateFolder: 'Templates/journal-folder',
      templateOverrideFolderName: 'Templates',
    }))
    seedJournalFolder(app, 'Journal', '---\nfoo: bar\n---\n# Folder body\n')
    await writeNote(app, 'Journal/Templates/daily-template.md', '# Override\n')

    const file = await createFile(app, 'Journal', '2026-05-07')
    // @ts-expect-error
    expect(await app.vault.read(file)).toBe('# Override\n')
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

  it('keeps a settings change made mid-migration when saving the migration flag', async () => {
    const saved: JournalFolderSettings[] = []
    const plugin = buildPlugin()
    const feature = new JournalAutoTemplateFeature(plugin, async (next) => {
      saved.push(next)
      feature.useSettings(next)
    })
    // Legacy inline content present + flag unset → the migration runs and
    // performs vault writes before its final save.
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      templatesMigratedToFiles: false,
      autoTemplateContent: '# Legacy template\n',
    })
    // noinspection JSIgnoredPromiseFromCall
    feature.load()
    // @ts-expect-error — test mock workspace
    plugin.app.workspace.signalLayoutReady()
    // Simulate a concurrent settings save landing while the migration's
    // vault writes are still in flight (before its own save runs).
    feature.useSettings({
      ...DEFAULT_SETTINGS,
      templatesMigratedToFiles: false,
      autoTemplateContent: '# Legacy template\n',
      tasksSidebarRange: 'year',
    })
    await new Promise((r) => setTimeout(r, 10))

    const final = saved.at(-1)
    expect(final).toBeDefined()
    // The flag is set AND the mid-migration change survives — the save
    // must re-read live settings, not the pre-await snapshot.
    expect(final?.templatesMigratedToFiles).toBe(true)
    expect(final?.tasksSidebarRange).toBe('year')
    // The migration itself still consumed the snapshot's legacy content.
    // @ts-expect-error — test mock vault
    expect(
      await plugin.app.vault.read(
        // @ts-expect-error — test mock vault
        plugin.app.vault.getAbstractFileByPath(
          'Templates/journal-folder/default-template.md'
        )
      )
    ).toBe('# Legacy template\n')
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
