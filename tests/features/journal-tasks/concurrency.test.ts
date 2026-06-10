import { describe, expect, it } from 'vitest'
import {
  mapWithConcurrency,
  TASK_READ_CONCURRENCY,
} from '../../../src/features/journal-tasks/concurrency'

// Resolvable-by-hand promise so tests can control completion order.
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('mapWithConcurrency', () => {
  it('returns results in input order even when completion order differs', async () => {
    const gates = [deferred<void>(), deferred<void>(), deferred<void>()]
    const result = mapWithConcurrency([0, 1, 2], 3, async (item) => {
      await gates[item].promise
      return `item-${item}`
    })
    // Complete in reverse order.
    gates[2].resolve()
    gates[1].resolve()
    gates[0].resolve()
    expect(await result).toEqual(['item-0', 'item-1', 'item-2'])
  })

  it('processes every item exactly once', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const seen: number[] = []
    const result = await mapWithConcurrency(items, 7, async (item) => {
      seen.push(item)
      return item * 2
    })
    expect(result).toEqual(items.map((i) => i * 2))
    expect([...seen].sort((a, b) => a - b)).toEqual(items)
  })

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let maxInFlight = 0
    await mapWithConcurrency(
      Array.from({ length: 40 }, (_, i) => i),
      4,
      async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        // Yield so other workers get a turn while this one is "reading".
        await Promise.resolve()
        inFlight -= 1
      }
    )
    expect(maxInFlight).toBeLessThanOrEqual(4)
    // The pool actually ran concurrently (not serially).
    expect(maxInFlight).toBeGreaterThan(1)
  })

  it('handles an empty input and a limit larger than the input', async () => {
    expect(await mapWithConcurrency([], 16, async (x) => x)).toEqual([])
    expect(
      await mapWithConcurrency([1, 2], 16, async (x: number) => x + 1)
    ).toEqual([2, 3])
  })

  it('clamps a non-positive limit to one worker', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const result = await mapWithConcurrency([1, 2, 3], 0, async (x) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Promise.resolve()
      inFlight -= 1
      return x
    })
    expect(result).toEqual([1, 2, 3])
    expect(maxInFlight).toBe(1)
  })

  it('propagates a rejection like Promise.all', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error('boom')
        return x
      })
    ).rejects.toThrow('boom')
  })

  it('exports a sane default pool size', () => {
    expect(TASK_READ_CONCURRENCY).toBeGreaterThan(1)
  })
})
