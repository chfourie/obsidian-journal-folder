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
  it('renders the icon in a gutter marker on the block and hides the tag when configured', () => {
    const root = tagEl()
    processSignifiers(
      root,
      settingsWith({
        signifierPlacement: 'margin',
        signifierHideTagInReadingView: true,
      })
    )
    const gutter = root.querySelector('.jf-signifier-gutter')
    const anchor = root.querySelector('a.tag') as HTMLElement
    expect(gutter).not.toBeNull()
    expect(gutter!.querySelector('.jf-signifier')).not.toBeNull()
    // The content host (here the root, no <li>/<p>) becomes the positioning
    // context and the marker is prepended into it.
    expect(root.classList.contains('jf-signifier-host')).toBe(true)
    expect(root.firstElementChild).toBe(gutter)
    expect(anchor.classList.contains('jf-signifier-hidden-tag')).toBe(true)
  })

  it('keeps the tag visible when hiding is off', () => {
    const root = tagEl()
    processSignifiers(
      root,
      settingsWith({
        signifierPlacement: 'margin',
        signifierHideTagInReadingView: false,
      })
    )
    const anchor = root.querySelector('a.tag') as HTMLElement
    expect(
      root.querySelector('.jf-signifier-gutter .jf-signifier')
    ).not.toBeNull()
    expect(anchor.classList.contains('jf-signifier-hidden-tag')).toBe(false)
  })

  it('hosts the gutter marker on a task list item’s content', () => {
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

    processSignifiers(root, settingsWith({ signifierPlacement: 'margin' }))
    const gutter = li.querySelector('.jf-signifier-gutter') as HTMLElement
    expect(gutter).not.toBeNull()
    // The list item (tight, no inner <p>) becomes the positioning host; the
    // absolutely-positioned marker is prepended into it.
    expect(li.classList.contains('jf-signifier-host')).toBe(true)
    expect(li.firstElementChild).toBe(gutter)
  })

  it('is idempotent across repeated runs', () => {
    const root = tagEl()
    const settings = settingsWith({ signifierHideTagInReadingView: true })
    processSignifiers(root, settings)
    processSignifiers(root, settings)
    expect(root.querySelectorAll('.jf-signifier').length).toBe(1)
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

  // Soft line breaks (Obsidian *Strict line breaks* off) render consecutive
  // lines as one <p> separated by <br>s. Each line is its own entry; its
  // signifier must land on its own line, not clump with the others.
  function softWrappedParagraph(lineCount: number): {
    root: HTMLElement
    p: HTMLElement
  } {
    const root = document.createElement('div')
    const p = document.createElement('p')
    for (let i = 0; i < lineCount; i++) {
      if (i > 0) p.appendChild(document.createElement('br'))
      p.appendChild(document.createTextNode(`Line ${i + 1} `))
      const a = document.createElement('a')
      a.className = 'tag'
      a.setAttribute('href', '#important')
      a.textContent = '#important'
      p.appendChild(a)
    }
    root.appendChild(p)
    return { root, p }
  }

  it('gives each soft-wrapped line its own marker instead of clumping them', () => {
    const { root, p } = softWrappedParagraph(3)
    processSignifiers(root, settingsWith({ signifierPlacement: 'margin' }))

    // One wrapper segment + one gutter marker per line.
    const lines = p.querySelectorAll('.jf-signifier-line')
    expect(lines.length).toBe(3)
    expect(p.querySelectorAll('.jf-signifier-gutter').length).toBe(3)
    // Each marker sits inside its own line segment, alongside that line's tag.
    lines.forEach((line) => {
      expect(line.querySelectorAll('.jf-signifier-gutter').length).toBe(1)
      expect(line.querySelector('a.tag')).not.toBeNull()
      expect(line.classList.contains('jf-signifier-host')).toBe(true)
    })
  })

  it('shares one line segment for multiple tags on the same soft-wrapped line', () => {
    const { root, p } = softWrappedParagraph(1)
    // Second tag on the same (only) line.
    const second = document.createElement('a')
    second.className = 'tag'
    second.setAttribute('href', '#important')
    second.textContent = '#important'
    p.appendChild(second)

    processSignifiers(root, settingsWith({ signifierPlacement: 'margin' }))
    // A single <br>-free line is not wrapped — it keeps the plain block path,
    // and both tags share one marker.
    expect(p.querySelectorAll('.jf-signifier-line').length).toBe(0)
    expect(p.querySelectorAll('.jf-signifier-gutter').length).toBe(1)
  })

  it('does not split a single-line paragraph (no <br>)', () => {
    const { root, p } = softWrappedParagraph(1)
    processSignifiers(root, settingsWith({ signifierPlacement: 'margin' }))
    expect(p.querySelectorAll('.jf-signifier-line').length).toBe(0)
    expect(p.querySelectorAll('.jf-signifier-gutter').length).toBe(1)
  })

  it('keeps soft-wrapped line splitting idempotent across repeated runs', () => {
    const { root, p } = softWrappedParagraph(3)
    const settings = settingsWith({ signifierPlacement: 'margin' })
    processSignifiers(root, settings)
    processSignifiers(root, settings)
    expect(p.querySelectorAll('.jf-signifier-line').length).toBe(3)
    expect(p.querySelectorAll('.jf-signifier').length).toBe(3)
  })

  it('does not split soft breaks inside a list item (one entry)', () => {
    const root = document.createElement('div')
    const ul = document.createElement('ul')
    const li = document.createElement('li')
    li.appendChild(document.createTextNode('Line 1 '))
    li.appendChild(document.createElement('br'))
    const a = document.createElement('a')
    a.className = 'tag'
    a.setAttribute('href', '#important')
    a.textContent = '#important'
    li.appendChild(a)
    ul.appendChild(li)
    root.appendChild(ul)

    processSignifiers(root, settingsWith({ signifierPlacement: 'margin' }))
    expect(li.querySelectorAll('.jf-signifier-line').length).toBe(0)
    expect(li.querySelectorAll('.jf-signifier-gutter').length).toBe(1)
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
