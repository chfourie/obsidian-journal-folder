import { describe, expect, it } from 'vitest'
import { shouldRebuildMigrationDecorations } from '../../../src/features/journal-tasks/migration-reference-live-preview'

const base = {
  docChanged: false,
  viewportChanged: false,
  selectionSet: false,
  settingsChanged: false,
  lastBuildFoundSpans: false,
}

describe('shouldRebuildMigrationDecorations', () => {
  it('skips a bare selection move when the last build found no spans', () => {
    // The common case: a note with no migration references must not
    // re-walk its visible lines on every cursor move.
    expect(
      shouldRebuildMigrationDecorations({ ...base, selectionSet: true })
    ).toBe(false)
  })

  it('rebuilds on a selection move when spans are in the viewport', () => {
    // A cursor entering / leaving a span reveals / re-hides it.
    expect(
      shouldRebuildMigrationDecorations({
        ...base,
        selectionSet: true,
        lastBuildFoundSpans: true,
      })
    ).toBe(true)
  })

  it('always rebuilds on doc / viewport / settings changes', () => {
    // These can introduce spans, so the span-free gate must not apply.
    expect(
      shouldRebuildMigrationDecorations({ ...base, docChanged: true })
    ).toBe(true)
    expect(
      shouldRebuildMigrationDecorations({ ...base, viewportChanged: true })
    ).toBe(true)
    expect(
      shouldRebuildMigrationDecorations({ ...base, settingsChanged: true })
    ).toBe(true)
  })

  it('does not rebuild on an update with no relevant change', () => {
    expect(shouldRebuildMigrationDecorations(base)).toBe(false)
    expect(
      shouldRebuildMigrationDecorations({ ...base, lastBuildFoundSpans: true })
    ).toBe(false)
  })
})
