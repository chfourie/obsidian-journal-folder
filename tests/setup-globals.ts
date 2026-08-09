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
