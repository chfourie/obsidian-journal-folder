import { describe, expect, it } from 'vitest'
import {
  colorSchemeMenuIcon,
  colorSchemeMenuLabel,
  nextColorScheme,
} from '../../../src/features/journal-ribbon-menu/theme-toggle'

describe('nextColorScheme', () => {
  it('switches dark → light', () => {
    expect(nextColorScheme('obsidian')).toBe('moonstone')
  })

  it('switches light → dark', () => {
    expect(nextColorScheme('moonstone')).toBe('obsidian')
  })

  it('defaults an unexpected value (e.g. unresolved "system") to dark', () => {
    // app.getTheme() resolves 'system' to an explicit scheme, so we never
    // expect it here — but be defensive: anything not 'obsidian' flips to dark.
    expect(nextColorScheme('system')).toBe('obsidian')
    expect(nextColorScheme('')).toBe('obsidian')
  })
})

describe('colorSchemeMenuLabel', () => {
  it('reads as an action toward the destination scheme', () => {
    expect(colorSchemeMenuLabel('obsidian')).toBe('Switch to light mode')
    expect(colorSchemeMenuLabel('moonstone')).toBe('Switch to dark mode')
  })
})

describe('colorSchemeMenuIcon', () => {
  it('depicts the destination scheme', () => {
    expect(colorSchemeMenuIcon('obsidian')).toBe('sun')
    expect(colorSchemeMenuIcon('moonstone')).toBe('moon')
  })
})
