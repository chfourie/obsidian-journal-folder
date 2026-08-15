import { describe, expect, it, vi } from 'vitest'
import { styleAsDestructive } from '../../../src/features/journal-folder-settings/destructive-button'

function fakeButton(withSetDestructive: boolean) {
  const classes = new Set<string>()
  return {
    buttonEl: {
      addClass: (cls: string) => classes.add(cls),
    } as unknown as HTMLElement,
    ...(withSetDestructive ? { setDestructive: vi.fn() } : {}),
    classes,
  }
}

describe('styleAsDestructive', () => {
  it('calls setDestructive when the running Obsidian provides it (1.13+)', () => {
    const button = fakeButton(true)
    styleAsDestructive(button)
    expect(button.setDestructive).toHaveBeenCalledOnce()
    expect(button.classes.has('mod-warning')).toBe(false)
  })

  it('falls back to the mod-warning class on older Obsidian', () => {
    const button = fakeButton(false)
    styleAsDestructive(button)
    expect(button.classes.has('mod-warning')).toBe(true)
  })

  it('returns the button for chaining', () => {
    const button = fakeButton(true)
    expect(styleAsDestructive(button)).toBe(button)
  })
})
