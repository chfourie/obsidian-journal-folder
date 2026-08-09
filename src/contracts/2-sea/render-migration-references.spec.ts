/**
 * Colocated, clause-mapped per the convention `test/fixtures/ts-target/src/booking.spec.ts`
 * realizes (a test title prefixed by the clause id it claims, a `(scenario N)` marker for the
 * numbered example it also realizes) — drafted with the owner via the ratify method primer
 * against `render-migration-references.md`, the repo's least-tested boundary at draft time.
 * Exercises the real, already-shipped `processMigrationReferences`/`matchTrailingMarker` — no
 * fakes, no mocks: the only injected input is a plain `JournalFolderSettings` object and a real
 * jsdom `HTMLElement`.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import {
  matchTrailingMarker,
  processMigrationReferences,
} from '../../features/journal-tasks/render-migration-references'
import { DEFAULT_SETTINGS, type JournalFolderSettings } from '../../data-access'

// Obsidian augments `HTMLElement.prototype` with `createSpan`/`createDiv`/`createEl` at runtime;
// jsdom (this repo's test environment) does not define them, and `tests/setup-globals.ts` does
// not polyfill them (no existing unit test exercises DOM-construction code that calls them —
// a real gap this contract's own drafting surfaced, scoped to this file rather than widened
// into shared test setup on a first retrofit's say-so).
beforeAll(() => {
  const proto = HTMLElement.prototype as HTMLElement & {
    createSpan?: (o?: { cls?: string }) => HTMLSpanElement
  }
  if (typeof proto.createSpan !== 'function') {
    proto.createSpan = function (this: HTMLElement, o?: { cls?: string }) {
      const span = this.ownerDocument.createElement('span')
      if (o?.cls) span.className = o.cls
      this.appendChild(span)
      return span
    }
  }
})

function settingsWith(
  overrides: Partial<JournalFolderSettings>
): JournalFolderSettings {
  return { ...DEFAULT_SETTINGS, ...overrides }
}

/** A rendered task line: a wrapping span holding label text immediately followed by an internal link. */
function elementWithLink(
  labelText: string,
  linkText = '2026-06-10'
): { el: HTMLElement; link: HTMLAnchorElement } {
  const el = document.createElement('div')
  const wrapper = el.appendChild(document.createElement('span'))
  wrapper.appendChild(document.createTextNode(labelText))
  const link = wrapper.appendChild(document.createElement('a'))
  link.className = 'internal-link'
  link.setAttribute('href', '#')
  link.textContent = linkText
  return { el, link }
}

describe('processMigrationReferences', () => {
  it('E1: (scenario 1) wraps a trailing marker and its link in a dimmed span, and the link still navigates', () => {
    const settings = settingsWith({
      taskMigrationToMarker: '→',
      taskMigrationFromMarker: '←',
      taskMigrationReferenceOpacity: 40,
    })
    const { el, link } = elementWithLink('Follow up on the budget review → ')

    processMigrationReferences(el, settings)

    const wrapper = link.closest('.jf-migration-ref')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.getAttribute('style')).toContain('--jf-migration-ref-opacity: 0.4')
    expect(link.getAttribute('href')).toBe('#')
    expect(el.textContent).toContain('Follow up on the budget review')
  })

  it('E2: (scenario 2) is a complete no-op when both markers are configured blank', () => {
    const settings = settingsWith({
      taskMigrationToMarker: '',
      taskMigrationFromMarker: '   ',
    })
    const { el } = elementWithLink('Follow up on the budget review → ')
    const before = el.innerHTML

    processMigrationReferences(el, settings)

    expect(el.innerHTML).toBe(before)
    expect(el.querySelector('.jf-migration-ref')).toBeNull()
  })

  it('E1/R1: (scenario 3) clamps an out-of-range configured opacity to 100', () => {
    const settings = settingsWith({
      taskMigrationToMarker: '→',
      taskMigrationFromMarker: '←',
      taskMigrationReferenceOpacity: 150,
    })
    const { el, link } = elementWithLink('Follow up on the budget review → ')

    processMigrationReferences(el, settings)

    const wrapper = link.closest('.jf-migration-ref') as HTMLElement
    expect(wrapper.style.getPropertyValue('--jf-migration-ref-opacity')).toBe('1')
  })

  it('E3: (scenario 4) leaves a marker glued to the preceding word (not a standalone token) untouched', () => {
    const settings = settingsWith({
      taskMigrationToMarker: '→',
      taskMigrationFromMarker: '←',
    })
    const { el, link } = elementWithLink('…plannedwork→')

    processMigrationReferences(el, settings)

    expect(link.closest('.jf-migration-ref')).toBeNull()
    expect(el.textContent).toContain('plannedwork→')
  })

  it('E1: (scenario 5) renders a lucide: marker as an icon, never as literal text', () => {
    const settings = settingsWith({
      taskMigrationToMarker: 'lucide:redo-2',
      taskMigrationFromMarker: 'lucide:undo-2',
    })
    const { el, link } = elementWithLink('Follow up on the budget review lucide:redo-2 ')

    processMigrationReferences(el, settings)

    const wrapper = link.closest('.jf-migration-ref') as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.querySelector('.jf-migration-ref-icon')).not.toBeNull()
    expect(wrapper.textContent).not.toContain('lucide:redo-2')
  })

  it('I1: (scenario 6) leaves an ordinary link with no trailing marker completely untouched', () => {
    const settings = settingsWith({
      taskMigrationToMarker: '→',
      taskMigrationFromMarker: '←',
    })
    const { el, link } = elementWithLink('See also ')
    const originalParent = link.parentElement

    processMigrationReferences(el, settings)

    expect(link.closest('.jf-migration-ref')).toBeNull()
    expect(link.parentElement).toBe(originalParent)
  })
})

describe('matchTrailingMarker', () => {
  it('is the already-tested pure helper this contract composes over end to end (see task-migration.test.ts)', () => {
    expect(matchTrailingMarker('do the thing → ', ['→', '←'])).toEqual({
      marker: '→',
      index: 13,
    })
  })
})
