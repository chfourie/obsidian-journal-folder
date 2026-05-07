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

export type EventRef = { name: string; cb: (...args: unknown[]) => unknown }

export class Vault {
  private files = new Map<string, TAbstractFile>()
  private contents = new Map<string, string>()
  private listeners: EventRef[] = []

  addFile(file: TAbstractFile): void {
    this.files.set(file.path, file)
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this.files.get(path) ?? null
  }

  getMarkdownFiles(): TFile[] {
    const out: TFile[] = []
    for (const f of this.files.values()) {
      if (f instanceof TFile && f.extension === 'md') out.push(f)
    }
    return out
  }

  getAllLoadedFiles(): TAbstractFile[] {
    return [...this.files.values()]
  }

  async create(path: string, content: string): Promise<TFile> {
    const file = new TFile()
    file.path = path
    file.name = path.split('/').pop() ?? path
    file.basename = file.name.replace(/\.md$/, '')
    file.extension = 'md'
    const parentPath = path.includes('/')
      ? path.slice(0, path.lastIndexOf('/'))
      : ''
    if (parentPath) {
      const parent = this.files.get(parentPath)
      file.parent = parent instanceof TFolder ? parent : null
    }
    this.files.set(path, file)
    this.contents.set(path, content)
    return file
  }

  setContents(file: TFile, content: string): void {
    this.contents.set(file.path, content)
  }

  async read(file: TFile): Promise<string> {
    return this.contents.get(file.path) ?? ''
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.contents.set(file.path, content)
  }

  on(name: string, cb: (...args: unknown[]) => unknown): EventRef {
    const ref = { name, cb }
    this.listeners.push(ref)
    return ref
  }

  trigger(name: string, ...args: unknown[]): void {
    this.listeners.filter((l) => l.name === name).forEach((l) => l.cb(...args))
  }
}

export class WorkspaceLeaf {
  view: unknown = null
  async setViewState(_state: unknown): Promise<void> {}
}

export class Workspace {
  private layoutReadyCallbacks: Array<() => void> = []
  private leafLeaves: WorkspaceLeaf[] = []
  private listeners: EventRef[] = []
  layoutReady = false
  activeFile: TFile | null = null

  onLayoutReady(cb: () => void): void {
    if (this.layoutReady) cb()
    else this.layoutReadyCallbacks.push(cb)
  }

  signalLayoutReady(): void {
    this.layoutReady = true
    const callbacks = this.layoutReadyCallbacks
    this.layoutReadyCallbacks = []
    callbacks.forEach((cb) => cb())
  }

  getLeavesOfType(_type: string): WorkspaceLeaf[] {
    return [...this.leafLeaves]
  }

  detachLeavesOfType(_type: string): void {
    this.leafLeaves = []
  }

  getRightLeaf(_split: boolean): WorkspaceLeaf | null {
    const leaf = new WorkspaceLeaf()
    this.leafLeaves.push(leaf)
    return leaf
  }

  revealLeaf(_leaf: WorkspaceLeaf): void {}

  getActiveFile(): TFile | null {
    return this.activeFile
  }

  on(name: string, cb: (...args: unknown[]) => unknown): EventRef {
    const ref = { name, cb }
    this.listeners.push(ref)
    return ref
  }

  trigger(name: string, ...args: unknown[]): void {
    this.listeners.filter((l) => l.name === name).forEach((l) => l.cb(...args))
  }
}

export class App {
  vault = new Vault()
  metadataCache = new MetadataCache()
  workspace = new Workspace()
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

  registerEvent(_ref: EventRef): void {}

  registerView(
    _type: string,
    _factory: (leaf: WorkspaceLeaf) => unknown
  ): void {}

  addRibbonIcon(
    _icon: string,
    _title: string,
    _cb: (evt: MouseEvent) => unknown
  ): HTMLElement {
    return document.createElement('div')
  }
}

export class ItemView {
  contentEl: HTMLElement = document.createElement('div')
  leaf: WorkspaceLeaf
  app: App = new App()
  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf
  }
  registerEvent(_ref: EventRef): void {}
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
  getViewType(): string {
    return ''
  }
  getDisplayText(): string {
    return ''
  }
  getIcon(): string {
    return ''
  }
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
  addTextArea(_cb: (t: unknown) => unknown): this {
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
  addDropdown(_cb: (d: unknown) => unknown): this {
    return this
  }
  setHeading(): this {
    return this
  }
}

export class FuzzySuggestModal<T> {
  app: App
  constructor(app: App) {
    this.app = app
  }
  setPlaceholder(_p: string): void {}
  open(): void {}
  close(): void {}
  // Subclasses override these. Default no-op implementations let the class
  // be imported without crashing under tests.
  getItems(): T[] {
    return []
  }
  getItemText(_item: T): string {
    return ''
  }
  onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
}

export class Modal {
  app: App
  contentEl: HTMLElement = document.createElement('div')
  titleEl: HTMLElement = document.createElement('div')
  constructor(app: App) {
    this.app = app
  }
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class DropdownComponent {
  addOption(_v: string, _l: string): this {
    return this
  }
  setValue(_v: string): this {
    return this
  }
  onChange(_cb: (v: string) => unknown): this {
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
