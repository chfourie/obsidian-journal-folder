import { describe, expect, it } from 'vitest'
import { createFenceTracker } from '../../../src/features/journal-tasks/fence-tracker'

// Feed all lines through one tracker and return the per-line verdicts.
function track(lines: string[]): boolean[] {
  const tracker = createFenceTracker()
  return lines.map((line) => tracker.next(line))
}

describe('createFenceTracker', () => {
  it('marks delimiter lines and interior content of a backtick fence', () => {
    expect(track(['before', '```', '- [ ] fake', '```', 'after'])).toEqual([
      false,
      true,
      true,
      true,
      false,
    ])
  })

  it('supports tilde fences', () => {
    expect(track(['~~~', 'code', '~~~', 'text'])).toEqual([
      true,
      true,
      true,
      false,
    ])
  })

  it('treats an unclosed fence as running to end of input', () => {
    expect(track(['```', '- [ ] fake', '- [ ] also fake'])).toEqual([
      true,
      true,
      true,
    ])
  })

  it('recognises indented fence delimiters (list-nested fences)', () => {
    expect(track(['  ```', '  - [ ] fake', '  ```', '- [ ] real'])).toEqual([
      true,
      true,
      true,
      false,
    ])
    // 4+ spaces still opens — deliberate divergence from CommonMark; see
    // the rationale comment in fence-tracker.ts.
    expect(track(['    ```', '    - [ ] fake', '    ```'])).toEqual([
      true,
      true,
      true,
    ])
  })

  it('accepts an info string on the opener', () => {
    expect(track(['```js', 'const x = 1', '```'])).toEqual([true, true, true])
  })

  it('does not close on a mismatched delimiter character', () => {
    expect(track(['~~~', '```', '- [ ] fake', '```', '~~~'])).toEqual([
      true,
      true,
      true,
      true,
      true,
    ])
  })

  it('does not close on a shorter delimiter run', () => {
    expect(track(['````', '```', 'still code', '````'])).toEqual([
      true,
      true,
      true,
      true,
    ])
  })

  it('closes on a longer delimiter run', () => {
    expect(track(['```', 'code', '````', 'after'])).toEqual([
      true,
      true,
      true,
      false,
    ])
  })

  it('does not treat a line-spanning inline code span as a fence opener', () => {
    // CommonMark: a backtick fence's info string may not contain a
    // backtick, so a lone ```code``` line is inline code, not a fence.
    expect(track(['```inline``` code', '- [ ] real'])).toEqual([false, false])
  })

  it('does not close a fence on a delimiter with trailing text', () => {
    expect(track(['```', '``` not a closer', '```', 'after'])).toEqual([
      true,
      true,
      true,
      false,
    ])
  })
})
