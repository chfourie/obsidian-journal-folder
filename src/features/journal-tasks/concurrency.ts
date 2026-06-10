/*
Obsidian Journal Folder - Utilities for folder-based journaling in Obsidian
Copyright (C) 2024  Charl Fourie

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// How many task-cache reads run concurrently when a walk hits a cold
// cache (plugin load, post-clear). Serial awaits made a 5-year daily
// folder pay N sequential `cachedRead` round-trips; unbounded
// `Promise.all` would fire them all at once.
export const TASK_READ_CONCURRENCY = 16

// Maps `items` through async `fn` with at most `limit` calls in flight,
// returning results in input order (a worker pool, not chunked batches —
// no straggler stalls the next batch). Rejections propagate like
// `Promise.all`.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    // `next++` is race-free: workers only interleave at the `await`,
    // after the index has been claimed.
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  const poolSize = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: poolSize }, worker))
  return results
}
