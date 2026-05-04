import { describe, expect, it } from 'vitest'
import { calendarCellClasses } from '../../src/features/journal-header/calendar-cell-classes'
import type { CalendarCell } from '../../src/features/journal-header/journal-calendar-info'

function cell(overrides: Partial<CalendarCell> = {}): CalendarCell {
  return {
    label: '1',
    url: 'Personal/2026-06-01',
    exists: false,
    isCurrent: false,
    isToday: false,
    isPast: false,
    needsConfirmation: false,
    isOutsideMonth: false,
    ...overrides,
  }
}

describe('calendarCellClasses', () => {
  it('always includes the base cell class', () => {
    const result = calendarCellClasses(cell())
    expect(result.split(' ')).toContain('journal-folder-calendar-cell')
  })

  it('marks existing cells with `exists` and omits `is-unresolved`', () => {
    const result = calendarCellClasses(cell({ exists: true }))
    const tokens = result.split(' ')
    expect(tokens).toContain('exists')
    expect(tokens).not.toContain('missing')
    expect(tokens).not.toContain('is-unresolved')
  })

  // Stamping `is-unresolved` ourselves is the whole reason this helper exists
  // (Obsidian's own pass misses cells inserted after the post-processor
  // returns — see calendar-cell-classes.ts).
  it('marks missing cells with both `missing` and `is-unresolved`', () => {
    const result = calendarCellClasses(cell({ exists: false }))
    const tokens = result.split(' ')
    expect(tokens).toContain('missing')
    expect(tokens).toContain('is-unresolved')
    expect(tokens).not.toContain('exists')
  })

  it('adds `is-current` when the cell matches the open note', () => {
    const result = calendarCellClasses(cell({ exists: true, isCurrent: true }))
    expect(result.split(' ')).toContain('is-current')
  })

  it('adds `is-today` for today regardless of existence', () => {
    expect(
      calendarCellClasses(cell({ exists: true, isToday: true })).split(' ')
    ).toContain('is-today')
    expect(
      calendarCellClasses(cell({ exists: false, isToday: true })).split(' ')
    ).toContain('is-today')
  })

  it('adds `past-missing` for past missing cells (alongside `missing` and `is-unresolved`)', () => {
    const result = calendarCellClasses(
      cell({ exists: false, isPast: true, needsConfirmation: true })
    )
    const tokens = result.split(' ')
    expect(tokens).toContain('missing')
    expect(tokens).toContain('is-unresolved')
    expect(tokens).toContain('past-missing')
  })

  it('does not add `past-missing` to non-past missing cells', () => {
    const result = calendarCellClasses(cell({ exists: false }))
    expect(result.split(' ')).not.toContain('past-missing')
  })

  it('does not add `past-missing` to past existing cells', () => {
    const result = calendarCellClasses(
      cell({ exists: true, isPast: true, needsConfirmation: false })
    )
    expect(result.split(' ')).not.toContain('past-missing')
  })
})
