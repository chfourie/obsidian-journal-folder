/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// Obsidian exposes `activeDocument` / `activeWindow` as globals that resolve
// to the document/window of the currently-focused (possibly popped-out) leaf.
// The plugin uses them for popout-window compatibility (the
// `obsidianmd/prefer-active-doc` rule). jsdom doesn't define them, so the test
// environment polyfills them to the single jsdom document/window — matching the
// single-window behaviour Obsidian falls back to.
const g = globalThis as typeof globalThis & {
  activeDocument?: Document
  activeWindow?: Window & typeof globalThis
}
if (typeof g.activeDocument === 'undefined' && typeof document !== 'undefined') {
  g.activeDocument = document
}
if (typeof g.activeWindow === 'undefined' && typeof window !== 'undefined') {
  g.activeWindow = window
}

// Obsidian also hangs `createEl` / `createDiv` / `createSpan` / `createFragment` off every
// window (verified live: a popout window's copies create nodes owned by *its* document, which
// is why `activeWindow.createSpan()` — the form `obsidianmd/prefer-create-el` mandates — is the
// popout-safe one). jsdom has none of them. The plugin only ever calls them with no arguments,
// so the polyfill covers exactly that: a detached node in this window's document.
type ObsidianDomHelpers = {
  createEl?: <K extends keyof HTMLElementTagNameMap>(
    tag: K
  ) => HTMLElementTagNameMap[K]
  createDiv?: () => HTMLDivElement
  createSpan?: () => HTMLSpanElement
  createFragment?: () => DocumentFragment
}

if (typeof window !== 'undefined') {
  const w = window as Window & ObsidianDomHelpers
  w.createEl ??= <K extends keyof HTMLElementTagNameMap>(tag: K) =>
    w.document.createElement(tag)
  w.createDiv ??= () => w.document.createElement('div')
  w.createSpan ??= () => w.document.createElement('span')
  w.createFragment ??= () => w.document.createDocumentFragment()
}

// Obsidian also extends Node/HTMLElement prototypes with DOM helpers
// (`createEl`, `createDiv`, `empty`, `addClass`, …). The settings-form
// renderers use them, so the renderer tests need jsdom equivalents. Only
// the option fields the plugin actually uses are supported (cls, text,
// attr).
type DomElementInfo = {
  cls?: string | string[]
  text?: string
  attr?: Record<string, string | number | boolean | null>
}

declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: DomElementInfo | string
    ): HTMLElementTagNameMap[K]
    createDiv(o?: DomElementInfo | string): HTMLDivElement
    createSpan(o?: DomElementInfo | string): HTMLSpanElement
    empty(): void
    addClass(...classes: string[]): void
    removeClass(...classes: string[]): void
    toggleClass(classes: string | string[], value: boolean): void
    setText(text: string): void
  }
}

if (typeof HTMLElement !== 'undefined') {
  const proto = HTMLElement.prototype as HTMLElement & {
    createEl?: unknown
    createDiv?: unknown
    createSpan?: unknown
    empty?: unknown
    addClass?: unknown
    removeClass?: unknown
    toggleClass?: unknown
    setText?: unknown
  }

  const applyInfo = (el: HTMLElement, o?: DomElementInfo | string): void => {
    if (typeof o === 'string') {
      el.className = o
      return
    }
    if (!o) return
    if (o.cls) {
      const classes = Array.isArray(o.cls) ? o.cls : o.cls.split(/\s+/)
      el.classList.add(...classes.filter(Boolean))
    }
    if (o.text !== undefined) el.textContent = o.text
    if (o.attr) {
      for (const [key, value] of Object.entries(o.attr)) {
        if (value === null) continue
        el.setAttribute(key, String(value))
      }
    }
  }

  proto.createEl ??= function (
    this: HTMLElement,
    tag: string,
    o?: DomElementInfo | string
  ) {
    const el = this.ownerDocument.createElement(tag)
    applyInfo(el, o)
    this.appendChild(el)
    return el
  }
  proto.createDiv ??= function (this: HTMLElement, o?: DomElementInfo | string) {
    return this.createEl('div', o)
  }
  proto.createSpan ??= function (this: HTMLElement, o?: DomElementInfo | string) {
    return this.createEl('span', o)
  }
  proto.empty ??= function (this: HTMLElement) {
    this.replaceChildren()
  }
  proto.addClass ??= function (this: HTMLElement, ...classes: string[]) {
    this.classList.add(...classes)
  }
  proto.removeClass ??= function (this: HTMLElement, ...classes: string[]) {
    this.classList.remove(...classes)
  }
  proto.toggleClass ??= function (
    this: HTMLElement,
    classes: string | string[],
    value: boolean
  ) {
    for (const cls of Array.isArray(classes) ? classes : [classes]) {
      this.classList.toggle(cls, value)
    }
  }
  proto.setText ??= function (this: HTMLElement, text: string) {
    this.textContent = text
  }
}
