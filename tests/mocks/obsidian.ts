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

  async createFolder(path: string): Promise<TFolder> {
    const existing = this.files.get(path)
    if (existing instanceof TFolder) return existing
    const folder = new TFolder()
    folder.path = path
    folder.name = path.split('/').pop() ?? path
    const parentPath = path.includes('/')
      ? path.slice(0, path.lastIndexOf('/'))
      : ''
    if (parentPath) {
      const parent = this.files.get(parentPath)
      folder.parent = parent instanceof TFolder ? parent : null
    }
    this.files.set(path, folder)
    return folder
  }

  setContents(file: TFile, content: string): void {
    this.contents.set(file.path, content)
  }

  async read(file: TFile): Promise<string> {
    return this.contents.get(file.path) ?? ''
  }

  async cachedRead(file: TFile): Promise<string> {
    return this.contents.get(file.path) ?? ''
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.contents.set(file.path, content)
  }

  async process(
    file: TFile,
    fn: (content: string) => string
  ): Promise<string> {
    const current = this.contents.get(file.path) ?? ''
    const next = fn(current)
    this.contents.set(file.path, next)
    return next
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

  openLinkText(_link: string, _src: string, _newLeaf: boolean): void {}

  on(name: string, cb: (...args: unknown[]) => unknown): EventRef {
    const ref = { name, cb }
    this.listeners.push(ref)
    return ref
  }

  trigger(name: string, ...args: unknown[]): void {
    this.listeners.filter((l) => l.name === name).forEach((l) => l.cb(...args))
  }
}

export class FileManager {
  constructor(private metadataCache: MetadataCache) {}
  async processFrontMatter(
    file: TFile,
    fn: (fm: FrontMatterCache) => void
  ): Promise<void> {
    const fm = { ...(this.metadataCache.getFileCache(file)?.frontmatter ?? {}) }
    fn(fm)
    this.metadataCache.setFrontmatter(file, fm)
  }
}

export class App {
  vault = new Vault()
  metadataCache = new MetadataCache()
  workspace = new Workspace()
  fileManager = new FileManager(this.metadataCache)
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

  registerMarkdownPostProcessor(
    _processor: (el: HTMLElement, ctx: unknown) => unknown
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
  // Declarative settings API (Obsidian 1.13+) surface. `update()` mirrors
  // the real behaviour of re-fetching definitions; rendering is not
  // simulated.
  settingItems: unknown[] = []

  constructor(app: App, plugin: Plugin) {
    this.app = app
    this.plugin = plugin
  }

  getSettingDefinitions(): unknown[] {
    return []
  }

  update(): void {
    this.settingItems = this.getSettingDefinitions()
  }

  refreshDomState(): void {}

  getControlValue(_key: string): unknown {
    return undefined
  }

  setControlValue(_key: string, _value: unknown): void | Promise<void> {}

  display(): void {}

  hide(): void {}
}

// Base class for imperative sub-pages of a declarative settings tab
// (Obsidian 1.13+). Subclasses implement `display()`.
export class SettingPage {
  rootEl: HTMLElement = document.createElement('div')
  titlebarEl: HTMLElement = document.createElement('div')
  containerEl: HTMLElement = document.createElement('div')
  title = ''

  display(): void {}

  hide(): void {}
}

// Structural mock of `SettingGroup` (Obsidian 1.11+): the grouped-section
// chrome the declarative settings renderer uses — `.setting-group` wrapper,
// heading row, `.setting-items` list that hosts the group's rows.
export class SettingGroup {
  groupEl: HTMLElement
  headingNameEl: HTMLElement
  listEl: HTMLElement

  constructor(containerEl: HTMLElement) {
    this.groupEl = document.createElement('div')
    this.groupEl.className = 'setting-group'
    const heading = document.createElement('div')
    heading.className = 'setting-item setting-item-heading'
    this.headingNameEl = document.createElement('div')
    this.headingNameEl.className = 'setting-item-name'
    heading.appendChild(this.headingNameEl)
    this.listEl = document.createElement('div')
    this.listEl.className = 'setting-items'
    this.groupEl.appendChild(heading)
    this.groupEl.appendChild(this.listEl)
    containerEl.appendChild(this.groupEl)
  }

  setHeading(text: string | DocumentFragment): this {
    applyTextOrFragment(this.headingNameEl, text)
    return this
  }
  addClass(...classes: string[]): this {
    this.groupEl.classList.add(...classes)
    return this
  }
  addSetting(cb: (setting: Setting) => void): this {
    cb(new Setting(this.listEl))
    return this
  }
  addSearch(_cb: (c: unknown) => unknown): this {
    return this
  }
  addExtraButton(cb: (b: ExtraButtonComponent) => unknown): this {
    cb(new ExtraButtonComponent(this.groupEl))
    return this
  }
}

function applyTextOrFragment(el: HTMLElement, value: unknown): void {
  el.textContent = ''
  if (typeof value === 'string') {
    el.textContent = value
  } else if (value instanceof DocumentFragment) {
    el.appendChild(value)
  }
}

// A structural mock of `Setting`: builds the real element skeleton
// (settingEl / infoEl / controlEl) and *invokes* the add* callbacks with
// component mocks, so renderer tests can find inputs and fire onChange
// handlers.
export class Setting {
  containerEl: HTMLElement
  settingEl: HTMLElement
  infoEl: HTMLElement
  nameEl: HTMLElement
  descEl: HTMLElement
  controlEl: HTMLElement
  components: unknown[] = []

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl
    this.settingEl = document.createElement('div')
    this.settingEl.className = 'setting-item'
    this.infoEl = document.createElement('div')
    this.infoEl.className = 'setting-item-info'
    this.nameEl = document.createElement('div')
    this.nameEl.className = 'setting-item-name'
    this.descEl = document.createElement('div')
    this.descEl.className = 'setting-item-description'
    this.controlEl = document.createElement('div')
    this.controlEl.className = 'setting-item-control'
    this.infoEl.appendChild(this.nameEl)
    this.infoEl.appendChild(this.descEl)
    this.settingEl.appendChild(this.infoEl)
    this.settingEl.appendChild(this.controlEl)
    containerEl.appendChild(this.settingEl)
  }

  private addComponent<T>(component: T, cb: (c: T) => unknown): this {
    this.components.push(component)
    cb(component)
    return this
  }

  setName(name: string | DocumentFragment): this {
    applyTextOrFragment(this.nameEl, name)
    return this
  }
  setDesc(desc: string | DocumentFragment): this {
    applyTextOrFragment(this.descEl, desc)
    return this
  }
  addText(cb: (t: TextComponent) => unknown): this {
    return this.addComponent(new TextComponent(this.controlEl), cb)
  }
  addTextArea(cb: (t: TextComponent) => unknown): this {
    return this.addComponent(new TextComponent(this.controlEl), cb)
  }
  addToggle(cb: (t: ToggleComponent) => unknown): this {
    return this.addComponent(new ToggleComponent(this.controlEl), cb)
  }
  addExtraButton(cb: (b: ExtraButtonComponent) => unknown): this {
    return this.addComponent(new ExtraButtonComponent(this.controlEl), cb)
  }
  addButton(cb: (b: ButtonComponent) => unknown): this {
    return this.addComponent(new ButtonComponent(this.controlEl), cb)
  }
  addMomentFormat(cb: (m: MomentFormatComponent) => unknown): this {
    return this.addComponent(new MomentFormatComponent(this.controlEl), cb)
  }
  addDropdown(cb: (d: DropdownComponent) => unknown): this {
    return this.addComponent(new DropdownComponent(this.controlEl), cb)
  }
  addSlider(cb: (s: unknown) => unknown): this {
    return this.addComponent({}, cb)
  }
  setHeading(): this {
    this.settingEl.classList.add('setting-item-heading')
    return this
  }
}

export interface MenuItemSnapshot {
  title?: string
  icon?: string
  click?: () => void
}
export class Menu {
  items: Array<MenuItemSnapshot | { separator: true }> = []
  addItem(cb: (item: unknown) => unknown): this {
    const snapshot: MenuItemSnapshot = {}
    const builder = {
      setTitle: (t: string) => {
        snapshot.title = t
        return builder
      },
      setIcon: (i: string) => {
        snapshot.icon = i
        return builder
      },
      onClick: (fn: () => void) => {
        snapshot.click = fn
        return builder
      },
    }
    cb(builder)
    this.items.push(snapshot)
    return this
  }
  addSeparator(): this {
    this.items.push({ separator: true })
    return this
  }
  showAtMouseEvent(_evt: MouseEvent): void {}
  showAtPosition(_pos: { x: number; y: number }): void {}
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

export class MarkdownRenderChild {
  containerEl: HTMLElement
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl
  }
  onload(): void {}
  onunload(): void {}
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
  selectEl: HTMLSelectElement = document.createElement('select')
  private changeCb: ((v: string) => unknown) | null = null

  constructor(containerEl?: HTMLElement) {
    containerEl?.appendChild(this.selectEl)
    this.selectEl.addEventListener('change', () => {
      void this.changeCb?.(this.selectEl.value)
    })
  }
  addOption(v: string, l: string): this {
    const option = document.createElement('option')
    option.value = v
    option.textContent = l
    this.selectEl.appendChild(option)
    return this
  }
  setValue(v: string): this {
    this.selectEl.value = v
    return this
  }
  getValue(): string {
    return this.selectEl.value
  }
  onChange(cb: (v: string) => unknown): this {
    this.changeCb = cb
    return this
  }
  // Test helper: emulate the user picking an option.
  trigger(v: string): unknown {
    this.setValue(v)
    return this.changeCb?.(v)
  }
}

export class TextComponent {
  inputEl: HTMLInputElement = document.createElement('input')
  private changeCb: ((v: string) => unknown) | null = null

  constructor(containerEl?: HTMLElement) {
    containerEl?.appendChild(this.inputEl)
    this.inputEl.addEventListener('input', () => {
      void this.changeCb?.(this.inputEl.value)
    })
  }
  setValue(v: string): this {
    this.inputEl.value = v
    return this
  }
  getValue(): string {
    return this.inputEl.value
  }
  onChange(cb: (v: string) => unknown): this {
    this.changeCb = cb
    return this
  }
  onChanged(): void {
    this.changeCb?.(this.inputEl.value)
  }
  // Test helper: emulate the user typing a value.
  trigger(v: string): unknown {
    this.setValue(v)
    return this.changeCb?.(v)
  }
}

export class ToggleComponent {
  toggleEl: HTMLElement = document.createElement('div')
  private value = false
  private changeCb: ((v: boolean) => unknown) | null = null

  constructor(containerEl?: HTMLElement) {
    containerEl?.appendChild(this.toggleEl)
  }
  setValue(v: boolean): this {
    this.value = v
    return this
  }
  getValue(): boolean {
    return this.value
  }
  onChange(cb: (v: boolean) => unknown): this {
    this.changeCb = cb
    return this
  }
  trigger(v: boolean): unknown {
    this.value = v
    return this.changeCb?.(v)
  }
}

export class MomentFormatComponent extends TextComponent {
  setDefaultFormat(_v: string): this {
    return this
  }
  setSampleEl(_el: HTMLElement): this {
    return this
  }
}

export class ExtraButtonComponent {
  extraSettingsEl: HTMLElement = document.createElement('button')
  private clickCb: (() => unknown) | null = null

  constructor(containerEl?: HTMLElement) {
    containerEl?.appendChild(this.extraSettingsEl)
  }
  setIcon(icon: string): this {
    this.extraSettingsEl.setAttribute('data-icon', icon)
    return this
  }
  setTooltip(tooltip: string): this {
    this.extraSettingsEl.setAttribute('aria-label', tooltip)
    return this
  }
  setDisabled(disabled: boolean): this {
    this.extraSettingsEl.toggleAttribute('disabled', disabled)
    return this
  }
  onClick(cb: () => unknown): this {
    this.clickCb = cb
    return this
  }
  trigger(): unknown {
    return this.clickCb?.()
  }
}

export class ButtonComponent {
  buttonEl: HTMLButtonElement = document.createElement('button')
  private clickCb: (() => unknown) | null = null

  constructor(containerEl?: HTMLElement) {
    containerEl?.appendChild(this.buttonEl)
  }
  setButtonText(text: string): this {
    this.buttonEl.textContent = text
    return this
  }
  setIcon(icon: string): this {
    this.buttonEl.setAttribute('data-icon', icon)
    return this
  }
  setCta(): this {
    return this
  }
  setDestructive(): this {
    this.buttonEl.classList.add('mod-destructive')
    return this
  }
  setWarning(): this {
    this.buttonEl.classList.add('mod-warning')
    return this
  }
  setTooltip(tooltip: string): this {
    this.buttonEl.setAttribute('aria-label', tooltip)
    return this
  }
  then(cb: (b: this) => unknown): this {
    cb(this)
    return this
  }
  onClick(cb: () => unknown): this {
    this.clickCb = cb
    return this
  }
  trigger(): unknown {
    return this.clickCb?.()
  }
}

// Minimal `setIcon` stub — only the call signature matters for tests.
export function setIcon(_el: HTMLElement, _icon: string): void {}

// CodeMirror StateField placeholder. The live-preview extensions import
// it to read whether the editor is in Live Preview vs Source mode; pure
// helpers that the unit tests exercise never touch it, so a stub keeps
// the named import resolvable without pulling in CodeMirror.
export const editorLivePreviewField = {} as unknown

// Tests can read the most recent Notice message via `Notice.lastMessage`.
export class Notice {
  static lastMessage: string | null = null
  constructor(message: string) {
    Notice.lastMessage = message
  }
}

export function debounce<Args extends unknown[], R>(
  cb: (...args: Args) => R,
  _timeout?: number,
  _resetTimer?: boolean
): (...args: Args) => R {
  // Keep tests deterministic by skipping the actual debounce.
  return cb
}
