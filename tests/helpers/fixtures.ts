import { App, TFile, TFolder, type FrontMatterCache } from 'obsidian'

type FileSpec = string | { name: string; frontmatter?: FrontMatterCache }

/**
 * Build a TFolder with TFile children, register everything with the App's
 * vault and metadata cache, and return both the folder and a map of
 * basename → TFile so tests can grab a specific file to feed into the SUT.
 */
export function buildFolder(
  app: App,
  folderName: string,
  files: FileSpec[],
  opts: { folderPath?: string } = {}
): { folder: TFolder; files: Record<string, TFile> } {
  const folder = new TFolder()
  folder.name = folderName
  folder.path = opts.folderPath ?? folderName

  const filesByName: Record<string, TFile> = {}

  for (const spec of files) {
    const name = typeof spec === 'string' ? spec : spec.name
    const frontmatter = typeof spec === 'string' ? undefined : spec.frontmatter

    const file = new TFile()
    file.basename = name.replace(/\.md$/, '')
    file.name = name.endsWith('.md') ? name : `${name}.md`
    file.path = `${folder.path}/${file.name}`
    file.parent = folder
    folder.children.push(file)

    app.vault.addFile(file)
    if (frontmatter) app.metadataCache.setFrontmatter(file, frontmatter)
    filesByName[file.basename] = file
  }

  app.vault.addFile(folder)
  return { folder, files: filesByName }
}

/**
 * Convenience: build a fresh App + folder + files in one call.
 */
export function buildApp(
  folderName: string,
  files: FileSpec[],
  opts?: { folderPath?: string }
): { app: App; folder: TFolder; files: Record<string, TFile> } {
  const app = new App()
  const { folder, files: filesByName } = buildFolder(
    app,
    folderName,
    files,
    opts
  )
  return { app, folder, files: filesByName }
}
