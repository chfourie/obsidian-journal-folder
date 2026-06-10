import { afterEach, describe, expect, it, vi } from 'vitest'
import { TFile } from '../../mocks/obsidian'
import {
  closeStatusPicker,
  openStatusPicker,
  openStatusPickerForTarget,
  setStatusPickerMigrationProvider,
  type StatusPickerMigrationTarget,
} from '../../../src/features/journal-tasks/status-picker-panel'
import { buildTaskModel } from '../../../src/features/journal-tasks/task-models/build-task-model'
import type { TaskStatus } from '../../../src/data-access/task-model.type'

const status = (overrides: Partial<TaskStatus>): TaskStatus => ({
  id: overrides.id ?? 'open',
  label: overrides.label ?? 'Open',
  char: overrides.char ?? ' ',
  isDone: overrides.isDone ?? false,
  next: overrides.next ?? 'open',
  shell: overrides.shell ?? { shape: 'none' },
  icon: overrides.icon ?? { source: { kind: 'none' } },
})

const model = buildTaskModel([
  status({ id: 'open', char: ' ', label: 'Open', next: 'done' }),
  status({ id: 'done', char: 'x', label: 'Done', isDone: true, next: 'open' }),
])

function anchor(): HTMLElement {
  const el = document.createElement('span')
  document.body.appendChild(el)
  return el
}

function panel(): HTMLElement | null {
  return document.querySelector('.jf-status-picker-panel')
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.jf-status-picker-item'))
}

afterEach(() => {
  closeStatusPicker()
  setStatusPickerMigrationProvider(null)
  document.body.innerHTML = ''
})

describe('openStatusPicker', () => {
  it('renders one row per status and marks the current one selected', () => {
    openStatusPicker({
      anchor: anchor(),
      model,
      currentStatus: 'done',
      onSelect: () => {},
    })
    const items = rows()
    expect(items).toHaveLength(2)
    expect(items.map((r) => r.textContent)).toEqual(['Open', 'Done'])
    const selected = items.filter((r) => r.classList.contains('is-selected'))
    expect(selected).toHaveLength(1)
    expect(selected[0].textContent).toBe('Done')
  })

  it('calls onSelect with the clicked status id and closes the panel', () => {
    const onSelect = vi.fn()
    openStatusPicker({ anchor: anchor(), model, currentStatus: 'open', onSelect })
    rows()[1].click()
    expect(onSelect).toHaveBeenCalledWith('done')
    expect(panel()).toBeNull()
  })

  it('replaces a previously open picker (single instance)', () => {
    openStatusPicker({ anchor: anchor(), model, currentStatus: 'open', onSelect: () => {} })
    openStatusPicker({ anchor: anchor(), model, currentStatus: 'open', onSelect: () => {} })
    expect(document.querySelectorAll('.jf-status-picker-panel')).toHaveLength(1)
  })

  describe('migrate action', () => {
    const target: StatusPickerMigrationTarget = {
      sourceFile: new TFile(),
      sourceLine: 3,
      rawText: '- [ ] do the thing',
    }

    it('omits the migrate row when no migrateTarget is supplied', () => {
      setStatusPickerMigrationProvider(() => () => {})
      openStatusPicker({ anchor: anchor(), model, currentStatus: 'open', onSelect: () => {} })
      expect(document.querySelector('.jf-status-picker-migrate')).toBeNull()
    })

    it('omits the migrate row when the provider returns null', () => {
      setStatusPickerMigrationProvider(() => null)
      openStatusPicker({
        anchor: anchor(),
        model,
        currentStatus: 'open',
        onSelect: () => {},
        migrateTarget: target,
      })
      expect(document.querySelector('.jf-status-picker-migrate')).toBeNull()
    })

    it('shows the migrate row and runs the provider action on click', () => {
      const run = vi.fn()
      const provider = vi.fn(() => run)
      setStatusPickerMigrationProvider(provider)
      openStatusPicker({
        anchor: anchor(),
        model,
        currentStatus: 'open',
        onSelect: () => {},
        migrateTarget: target,
      })
      expect(provider).toHaveBeenCalledWith(target)
      const migrateRow = document.querySelector<HTMLElement>(
        '.jf-status-picker-migrate'
      )
      expect(migrateRow).not.toBeNull()
      migrateRow!.click()
      expect(run).toHaveBeenCalledOnce()
      expect(panel()).toBeNull()
    })
  })
})

// The panel must read viewport geometry and attach its resize listener on
// `activeWindow` (the window hosting the focused leaf), not the bare
// `window` global — in a popout window the two differ and a bare-`window`
// clamp positions against the wrong viewport. Simulated by swapping the
// `activeWindow` polyfill for a stub with its own dimensions/listeners.
describe('popout window compatibility (activeWindow)', () => {
  const g = globalThis as typeof globalThis & { activeWindow: unknown }
  const realActiveWindow = g.activeWindow

  afterEach(() => {
    g.activeWindow = realActiveWindow
  })

  it('attaches and removes its resize listener on activeWindow', () => {
    const popoutWindow = {
      innerWidth: 500,
      innerHeight: 400,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    g.activeWindow = popoutWindow

    openStatusPicker({ anchor: anchor(), model, currentStatus: 'open', onSelect: () => {} })
    expect(popoutWindow.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    )

    closeStatusPicker()
    expect(popoutWindow.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    )
  })

  it('clamps the panel into the activeWindow viewport, not the global one', () => {
    // A tiny active viewport forces the clamp paths; jsdom's own `window`
    // reports 1024×768, so a position inside [0, 500/400] proves the
    // stub's dimensions were the ones read.
    g.activeWindow = {
      innerWidth: 500,
      innerHeight: 400,
      addEventListener: () => {},
      removeEventListener: () => {},
    }

    openStatusPicker({ anchor: anchor(), model, currentStatus: 'open', onSelect: () => {} })
    const el = panel()!
    const top = Number.parseFloat(el.style.top)
    const left = Number.parseFloat(el.style.left)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left).toBeLessThanOrEqual(500)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top).toBeLessThanOrEqual(400)
  })
})

describe('openStatusPickerForTarget', () => {
  const mutationTarget = {
    sourceFile: new TFile(),
    sourceLine: 2,
    status: 'open',
  }

  it('queries the migration provider with rawText when given', () => {
    const provider = vi.fn(() => null)
    setStatusPickerMigrationProvider(provider)
    openStatusPickerForTarget(
      anchor(),
      mutationTarget,
      model,
      {} as never,
      '- [ ] something'
    )
    expect(provider).toHaveBeenCalledWith({
      sourceFile: mutationTarget.sourceFile,
      sourceLine: 2,
      rawText: '- [ ] something',
    })
  })

  it('does not offer migration when rawText is omitted', () => {
    const provider = vi.fn(() => () => {})
    setStatusPickerMigrationProvider(provider)
    openStatusPickerForTarget(anchor(), mutationTarget, model, {} as never)
    expect(provider).not.toHaveBeenCalled()
    expect(document.querySelector('.jf-status-picker-migrate')).toBeNull()
  })
})
