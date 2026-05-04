/*
Test-only mock of the `obsidian` module.

Surfaces just enough of the real package to exercise the plugin code under
test: TFile/TFolder/TAbstractFile (real classes so `instanceof` works),
`moment` (delegated to the real moment package, which Obsidian also bundles),
`normalizePath`, and a Plugin shell with App/Vault/MetadataCache stubs.
*/

import realMoment from 'moment'

export const moment = realMoment

export class TAbstractFile {
  vault: Vault = new Vault()
  path = ''
  name = ''
  parent: TFolder | null = null
}

export class TFile extends TAbstractFile {
  basename = ''
  extension = 'md'
  stat: { ctime: number; mtime: number; size: number } = {
    ctime: 0,
    mtime: 0,
    size: 0,
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = []
  isRoot(): boolean {
    return this.path === '' || this.path === '/'
  }
}

// Real Obsidian exposes a Platform constant with `isMobile`/`isPhone`/etc.
// Tests assume desktop unless they explicitly toggle this.
export const Platform = {
  isDesktop: true,
  isMobile: false,
  isPhone: false,
  isTablet: false,
}

export function normalizePath(path: string): string {
  // Obsidian's normalizePath collapses repeated slashes and trims trailing
  // slashes — close enough for the journal-note tests.
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/'
}

// Tiny Array.first() polyfill — the real `obsidian` package extends
// Array.prototype with `.first()`. journal-note.ts uses it.
declare global {
  interface Array<T> {
    first(): T | undefined
  }
}
if (!Array.prototype.first) {
  Object.defineProperty(Array.prototype, 'first', {
    value(this: unknown[]) {
      return this[0]
    },
    writable: true,
    configurable: true,
  })
}

export type FrontMatterCache = Record<string, unknown>

export class MetadataCache {
  private cache = new Map<string, { frontmatter?: FrontMatterCache }>()

  setFrontmatter(file: TFile, frontmatter: FrontMatterCache): void {
    this.cache.set(file.path, { frontmatter })
  }

  getFileCache(
    file: TFile
  ): { frontmatter?: FrontMatterCache } | null {
    return this.cache.get(file.path) ?? null
  }
}

export class Vault {
  private files = new Map<string, TAbstractFile>()

  addFile(file: TAbstractFile): void {
    this.files.set(file.path, file)
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this.files.get(path) ?? null
  }
}

export class App {
  vault = new Vault()
  metadataCache = new MetadataCache()
}

export class Plugin {
  app: App
  manifest: PluginManifest

  constructor(app: App, manifest: PluginManifest) {
    this.app = app
    this.manifest = manifest
  }

  // The real Plugin persists JSON via Obsidian's data store. Tests overwrite
  // these on a per-instance basis when they care about persistence.
  saveData = async (_data: unknown): Promise<void> => {}
  loadData = async (): Promise<unknown> => null

  addSettingTab(_tab: unknown): void {}

  registerMarkdownCodeBlockProcessor(
    _name: string,
    _processor: (source: string, el: HTMLElement, ctx: unknown) => unknown
  ): void {}
}

export type PluginManifest = {
  id: string
  name: string
  version: string
  minAppVersion: string
  description: string
  author: string
  authorUrl?: string
  isDesktopOnly?: boolean
}

export class PluginSettingTab {
  app: App
  plugin: Plugin
  containerEl: HTMLElement = document.createElement('div')

  constructor(app: App, plugin: Plugin) {
    this.app = app
    this.plugin = plugin
  }

  display(): void {}

  hide(): void {}
}

export class Setting {
  containerEl: HTMLElement
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl
  }
  setName(_name: string): this {
    return this
  }
  setDesc(_desc: string): this {
    return this
  }
  addText(_cb: (t: unknown) => unknown): this {
    return this
  }
  addToggle(_cb: (t: unknown) => unknown): this {
    return this
  }
  addExtraButton(_cb: (b: unknown) => unknown): this {
    return this
  }
  addButton(_cb: (b: unknown) => unknown): this {
    return this
  }
  addMomentFormat(_cb: (m: unknown) => unknown): this {
    return this
  }
}

export class TextComponent {
  setValue(_v: string): this {
    return this
  }
  onChange(_cb: (v: string) => unknown): this {
    return this
  }
}

export class ToggleComponent {
  setValue(_v: boolean): this {
    return this
  }
  onChange(_cb: (v: boolean) => unknown): this {
    return this
  }
}

export class MomentFormatComponent {
  setDefaultFormat(_v: string): this {
    return this
  }
  setSampleEl(_el: HTMLElement): this {
    return this
  }
  setValue(_v: string): this {
    return this
  }
  onChange(_cb: (v: string) => unknown): this {
    return this
  }
  onChanged(): void {}
}

export function debounce<Args extends unknown[], R>(
  cb: (...args: Args) => R,
  _timeout?: number,
  _resetTimer?: boolean
): (...args: Args) => R {
  // Keep tests deterministic by skipping the actual debounce.
  return cb
}
