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

import type { ColorRef } from '../../data-access'

// Semantic tokens — picked from Obsidian's design system. These
// follow the active theme automatically and read with their
// "purpose" (text vs accent vs muted) rather than a literal hue.
const SEMANTIC_TOKENS: Array<{ var: string; label: string }> = [
  { var: '--text-normal', label: 'Text normal' },
  { var: '--text-muted', label: 'Text muted' },
  { var: '--text-faint', label: 'Text faint' },
  { var: '--text-accent', label: 'Text accent' },
  { var: '--text-on-accent', label: 'Text on accent' },
  { var: '--text-error', label: 'Text error' },
  { var: '--text-success', label: 'Text success' },
  { var: '--text-warning', label: 'Text warning' },
  { var: '--interactive-accent', label: 'Interactive accent' },
  { var: '--background-modifier-border', label: 'Border subtle' },
  { var: '--background-modifier-hover', label: 'Hover background' },
  { var: '--checkbox-border-color', label: 'Checkbox border' },
  { var: '--checkbox-color', label: 'Checkbox fill' },
]

// Swatch palette — Obsidian's named accent hues.
const PALETTE_TOKENS: Array<{ var: string; label: string }> = [
  { var: '--color-red', label: 'Red' },
  { var: '--color-orange', label: 'Orange' },
  { var: '--color-yellow', label: 'Yellow' },
  { var: '--color-green', label: 'Green' },
  { var: '--color-cyan', label: 'Cyan' },
  { var: '--color-blue', label: 'Blue' },
  { var: '--color-purple', label: 'Purple' },
  { var: '--color-pink', label: 'Pink' },
]

type Tab = 'semantic' | 'palette' | 'custom'

export type ColorPickerConfig = {
  // The container to render into. Should be a fresh element — the
  // picker manages its own children and re-renders on tab switch.
  containerEl: HTMLElement
  // Optional heading rendered above the swatch. Omit to use the
  // picker as an inline control under an existing Setting row.
  label?: string
  description?: string
  value: ColorRef | undefined
  // Whether the picker should expose a "Clear" affordance that emits
  // `undefined` (i.e. transparent / inherit). On by default.
  allowClear?: boolean
  // Drops the outer card frame so the picker can nest inside other
  // bordered containers without doubling the visual frame.
  compact?: boolean
  onChange: (next: ColorRef | undefined) => void
}

// Renders a three-tab colour picker — Semantic / Palette / Custom —
// that emits a `ColorRef | undefined` through `onChange`. The
// "current selection" swatch + label refresh live on every change so
// the user can see what they picked without closing the dialog.
export function renderColorPicker(config: ColorPickerConfig): void {
  const {
    containerEl,
    label,
    description,
    value: initialValue,
    allowClear = true,
    compact = false,
    onChange,
  } = config

  containerEl.empty()
  containerEl.addClass('jf-color-picker')
  if (compact) containerEl.addClass('is-compact')

  if (label || description) {
    const header = containerEl.createDiv({ cls: 'jf-color-picker-header' })
    if (label) header.createSpan({ cls: 'jf-color-picker-label', text: label })
    if (description) {
      header.createSpan({
        cls: 'jf-color-picker-desc',
        text: description,
      })
    }
  }

  // Mutable cell so handlers can re-derive the current value when
  // the user repeatedly picks from a tab without re-rendering.
  let currentValue: ColorRef | undefined = initialValue

  const swatchRow = containerEl.createDiv({ cls: 'jf-color-picker-current' })
  const previewSwatch = swatchRow.createSpan({ cls: 'jf-color-swatch' })
  const previewLabel = swatchRow.createSpan({
    cls: 'jf-color-picker-current-label',
  })

  if (allowClear) {
    const clearBtn = swatchRow.createEl('button', {
      cls: 'jf-color-picker-clear',
      text: 'Clear',
    })
    clearBtn.type = 'button'
    clearBtn.onclick = (e) => {
      e.preventDefault()
      emit(undefined)
    }
  }

  const tabsEl = containerEl.createDiv({ cls: 'jf-color-picker-tabs' })
  const bodyEl = containerEl.createDiv({ cls: 'jf-color-picker-body' })

  const emit = (next: ColorRef | undefined): void => {
    currentValue = next
    paintSwatch(previewSwatch, next)
    previewLabel.setText(describeValue(next))
    onChange(next)
  }
  // Seed the swatch from the initial value.
  paintSwatch(previewSwatch, currentValue)
  previewLabel.setText(describeValue(currentValue))

  const renderTab = (tab: Tab): void => {
    bodyEl.empty()
    if (tab === 'semantic') {
      renderTokenGrid(bodyEl, SEMANTIC_TOKENS, () => currentValue, emit)
    } else if (tab === 'palette') {
      renderTokenGrid(bodyEl, PALETTE_TOKENS, () => currentValue, emit)
    } else {
      renderCustomEditor(bodyEl, () => currentValue, emit)
    }
  }

  const tabButton = (tab: Tab, text: string): HTMLButtonElement => {
    const btn = tabsEl.createEl('button', {
      cls: 'jf-color-picker-tab',
      text,
    })
    btn.type = 'button'
    if (tab === inferTab(currentValue)) btn.addClass('is-active')
    btn.onclick = (e) => {
      e.preventDefault()
      tabsEl
        .findAll('.jf-color-picker-tab')
        .forEach((b) => b.removeClass('is-active'))
      btn.addClass('is-active')
      renderTab(tab)
    }
    return btn
  }

  tabButton('semantic', 'Semantic')
  tabButton('palette', 'Palette')
  tabButton('custom', 'Custom')

  renderTab(inferTab(currentValue))
}

// ---------------- internals --------------------------------------

function renderTokenGrid(
  containerEl: HTMLElement,
  tokens: Array<{ var: string; label: string }>,
  getCurrent: () => ColorRef | undefined,
  emit: (next: ColorRef) => void
): void {
  const grid = containerEl.createDiv({ cls: 'jf-color-token-grid' })
  const buttonByVar = new Map<string, HTMLButtonElement>()
  for (const token of tokens) {
    const cell = grid.createEl('button', { cls: 'jf-color-token' })
    cell.type = 'button'
    cell.title = token.label
    cell.setAttr('aria-label', token.label)
    const swatch = cell.createSpan({ cls: 'jf-color-swatch' })
    swatch.style.background = `var(${token.var})`
    cell.createSpan({
      cls: 'jf-color-token-label',
      text: token.label,
    })
    cell.onclick = (e) => {
      e.preventDefault()
      emit({ kind: 'token', var: token.var })
      paintActiveToken(buttonByVar, token.var)
    }
    buttonByVar.set(token.var, cell)
  }
  const current = getCurrent()
  if (current?.kind === 'token') paintActiveToken(buttonByVar, current.var)
}

function paintActiveToken(
  buttonByVar: Map<string, HTMLButtonElement>,
  activeVar: string
): void {
  buttonByVar.forEach((btn) => btn.removeClass('is-active'))
  buttonByVar.get(activeVar)?.addClass('is-active')
}

function renderCustomEditor(
  containerEl: HTMLElement,
  getCurrent: () => ColorRef | undefined,
  emit: (next: ColorRef) => void
): void {
  const row = containerEl.createDiv({ cls: 'jf-color-custom' })
  const current = getCurrent()

  const colorInput = row.createEl('input', {
    cls: 'jf-color-custom-picker',
    attr: { type: 'color' },
  })
  colorInput.value = literalToHex(current) ?? '#888888'
  colorInput.oninput = () => {
    emit({ kind: 'literal', value: colorInput.value })
    textInput.value = colorInput.value
  }

  const textInput = row.createEl('input', {
    cls: 'jf-color-custom-text',
    attr: { type: 'text', placeholder: '#rrggbb or any CSS colour' },
  })
  textInput.value = current?.kind === 'literal' ? current.value : ''
  textInput.onchange = () => {
    const next = textInput.value.trim()
    if (next.length === 0) return
    emit({ kind: 'literal', value: next })
    if (looksLikeHex(next)) colorInput.value = next
  }
}

function paintSwatch(el: HTMLElement, value: ColorRef | undefined): void {
  if (!value) {
    el.style.background = 'transparent'
    el.style.backgroundImage =
      'linear-gradient(135deg, transparent calc(50% - 1px), ' +
      'var(--text-faint) calc(50% - 1px), var(--text-faint) calc(50% + 1px), ' +
      'transparent calc(50% + 1px))'
    el.style.border = '1px dashed var(--text-faint)'
    return
  }
  el.style.backgroundImage = ''
  el.style.border = '1px solid var(--background-modifier-border)'
  el.style.background =
    value.kind === 'token' ? `var(${value.var})` : value.value
}

function describeValue(value: ColorRef | undefined): string {
  if (!value) return 'Transparent / inherit'
  if (value.kind === 'token') return `var(${value.var})`
  return value.value
}

function inferTab(value: ColorRef | undefined): Tab {
  if (!value) return 'semantic'
  if (value.kind === 'literal') return 'custom'
  if (SEMANTIC_TOKENS.some((t) => t.var === value.var)) return 'semantic'
  if (PALETTE_TOKENS.some((t) => t.var === value.var)) return 'palette'
  return 'semantic'
}

function literalToHex(value: ColorRef | undefined): string | null {
  if (!value || value.kind !== 'literal') return null
  return looksLikeHex(value.value) ? value.value : null
}

function looksLikeHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim())
}
