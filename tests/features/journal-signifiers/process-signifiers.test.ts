import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  type JournalFolderSettings,
  type Signifier,
} from '../../../src/data-access'
import {
  listDepth,
  processSignifiers,
} from '../../../src/features/journal-signifiers/process-signifiers'

const signifiers: Signifier[] = [
  {
    id: 'priority',
    label: 'Priority',
    tags: ['important'],
    icon: { source: { kind: 'lucide', name: 'star' } },
  },
]

function settingsWith(
  overrides: Partial<JournalFolderSettings>
): JournalFolderSettings {
  return { ...DEFAULT_SETTINGS, signifiers, ...overrides }
}

function tagEl(): HTMLElement {
  const root = document.createElement('div')
  const a = document.createElement('a')
  a.className = 'tag'
  a.setAttribute('href', '#important')
  a.textContent = '#important'
  root.appendChild(a)
  return root
}

describe('processSignifiers', () => {
  it('renders the icon in a leading marker on the block and hides the tag when configured', () => {
    const root = tagEl()
    processSignifiers(root, settingsWith({ signifierHideTagInReadingView: true }))
    const lead = root.querySelector('.jf-signifier-lead')
    const anchor = root.querySelector('a.tag') as HTMLElement
    expect(lead).not.toBeNull()
    expect(lead!.querySelector('.jf-signifier')).not.toBeNull()
    // Flow placement: the lead marker is the block's first child (no task
    // checkbox in this fixture), so it precedes the tag in document order.
    expect(root.firstElementChild).toBe(lead)
    expect(anchor.classList.contains('jf-signifier-hidden-tag')).toBe(true)
  })

  it('keeps the tag visible when hiding is off', () => {
    const root = tagEl()
    processSignifiers(
      root,
      settingsWith({ signifierHideTagInReadingView: false })
    )
    const anchor = root.querySelector('a.tag') as HTMLElement
    expect(root.querySelector('.jf-signifier-lead .jf-signifier')).not.toBeNull()
    expect(anchor.classList.contains('jf-signifier-hidden-tag')).toBe(false)
  })

  it('places the start marker after the checkbox, before the entry text', () => {
    const root = document.createElement('div')
    const li = document.createElement('li')
    li.className = 'task-list-item'
    const checkbox = document.createElement('input')
    checkbox.className = 'task-list-item-checkbox'
    checkbox.type = 'checkbox'
    li.appendChild(checkbox)
    const a = document.createElement('a')
    a.className = 'tag'
    a.setAttribute('href', '#important')
    a.textContent = '#important'
    li.appendChild(a)
    root.appendChild(li)

    processSignifiers(root, settingsWith({ signifierPlacement: 'start' }))
    const lead = li.querySelector('.jf-signifier-lead') as HTMLElement
    expect(lead).not.toBeNull()
    // Reads as `☐ ★ text` — icon sits inline after the checkbox, before the
    // text, so it never wraps to its own line and aligns at any nesting.
    expect(checkbox.nextElementSibling).toBe(lead)
  })

  it('is idempotent across repeated runs', () => {
    const root = tagEl()
    const settings = settingsWith({ signifierHideTagInReadingView: true })
    processSignifiers(root, settings)
    processSignifiers(root, settings)
    expect(root.querySelectorAll('.jf-signifier').length).toBe(1)
  })

  it('renders a trailing marker at the end of the block for end placement', () => {
    const root = tagEl()
    processSignifiers(root, settingsWith({ signifierPlacement: 'end' }))
    const trail = root.querySelector('.jf-signifier-trail')
    expect(trail).not.toBeNull()
    expect(trail!.querySelector('.jf-signifier')).not.toBeNull()
    // Appended after the tag (end of the line).
    expect(root.lastElementChild).toBe(trail)
  })

  it('uses a gutter marker on a positioning host for margin placement', () => {
    const root = tagEl()
    processSignifiers(root, settingsWith({ signifierPlacement: 'margin' }))
    const gutter = root.querySelector('.jf-signifier-gutter')
    expect(gutter).not.toBeNull()
    expect(gutter!.querySelector('.jf-signifier')).not.toBeNull()
    // A positioning context is established on the content host (here the
    // root, since the fixture has no <li>/<p>) so CSS can hang the absolute
    // marker off it and centre it vertically.
    expect(root.classList.contains('jf-signifier-host')).toBe(true)
  })

  it('uses a column gutter marker with a depth stamp for margin-column placement', () => {
    // Two levels of nesting: depth 2 for the inner item.
    const root = document.createElement('div')
    const outer = document.createElement('ul')
    const outerLi = document.createElement('li')
    const inner = document.createElement('ul')
    const innerLi = document.createElement('li')
    const a = document.createElement('a')
    a.className = 'tag'
    a.setAttribute('href', '#important')
    a.textContent = '#important'
    innerLi.appendChild(a)
    inner.appendChild(innerLi)
    outerLi.appendChild(inner)
    outer.appendChild(outerLi)
    root.appendChild(outer)

    processSignifiers(root, settingsWith({ signifierPlacement: 'margin-column' }))
    const gutter = innerLi.querySelector('.jf-signifier-gutter') as HTMLElement
    expect(gutter).not.toBeNull()
    // Single-column variant: carries the column modifier and the nesting
    // depth so CSS can pull it back into one shared column.
    expect(gutter.classList.contains('jf-signifier-column')).toBe(true)
    expect(gutter.style.getPropertyValue('--jf-sig-depth')).toBe('2')
    // Still a positioning host on the entry's content (here the <li>).
    expect(innerLi.classList.contains('jf-signifier-host')).toBe(true)
  })

  it('leaves unmatched tags untouched', () => {
    const root = document.createElement('div')
    const a = document.createElement('a')
    a.className = 'tag'
    a.setAttribute('href', '#groceries')
    a.textContent = '#groceries'
    root.appendChild(a)
    processSignifiers(root, settingsWith({}))
    expect(root.querySelector('.jf-signifier')).toBeNull()
  })
})

describe('listDepth', () => {
  it('is 0 for a top-level list item or a non-list block', () => {
    const p = document.createElement('p')
    expect(listDepth(p)).toBe(0)

    const ul = document.createElement('ul')
    const li = document.createElement('li')
    ul.appendChild(li)
    expect(listDepth(li)).toBe(1) // one ancestor list
  })

  it('counts each ancestor ul/ol once', () => {
    const root = document.createElement('div')
    const ul = document.createElement('ul')
    const li = document.createElement('li')
    const ol = document.createElement('ol')
    const innerLi = document.createElement('li')
    ol.appendChild(innerLi)
    li.appendChild(ol)
    ul.appendChild(li)
    root.appendChild(ul)
    expect(listDepth(innerLi)).toBe(2)
  })
})
