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

/**
 * Obsidian's `createEl` / `createDiv` / `createSpan` / `createFragment` helpers are declared in
 * `obsidian.d.ts` (1.13.1) as ambient globals and on `Node`, but **not** on `Window` — even though
 * `eslint-plugin-obsidianmd`'s own `prefer-create-el` rule rewrites `activeDocument.createElement`
 * to `activeWindow.createSpan()` and friends. Without this augmentation every such call resolves
 * to an error type and cascades into ~300 `no-unsafe-*` errors.
 *
 * Verified live against Obsidian 1.13 rather than assumed: all four exist on `window`, are
 * identical to the globals, and a popout window's own copies create elements owned by the popout's
 * document — which is exactly why `activeWindow` is the right receiver for popout support.
 */
export {}

declare global {
  interface Window {
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      o?: DomElementInfo | string,
      callback?: (el: HTMLElementTagNameMap[K]) => void
    ): HTMLElementTagNameMap[K]
    createDiv(
      o?: DomElementInfo | string,
      callback?: (el: HTMLDivElement) => void
    ): HTMLDivElement
    createSpan(
      o?: DomElementInfo | string,
      callback?: (el: HTMLSpanElement) => void
    ): HTMLSpanElement
    createSvg<K extends keyof SVGElementTagNameMap>(
      tag: K,
      o?: SvgElementInfo | string,
      callback?: (el: SVGElementTagNameMap[K]) => void
    ): SVGElementTagNameMap[K]
    createFragment(callback?: (el: DocumentFragment) => void): DocumentFragment
  }
}
