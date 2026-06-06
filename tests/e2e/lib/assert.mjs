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

// Tiny assertion library — throws AssertionError with a readable message that
// the harness prints under the failing test.

export class AssertionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AssertionError'
  }
}

export function ok(cond, msg = 'expected truthy value') {
  if (!cond) throw new AssertionError(msg)
}

export function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new AssertionError(
      `${msg ? msg + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    )
  }
}

export function notEq(actual, unexpected, msg) {
  if (actual === unexpected) {
    throw new AssertionError(
      `${msg ? msg + ': ' : ''}expected value to differ from ${JSON.stringify(unexpected)}`
    )
  }
}

export function contains(haystack, needle, msg) {
  if (haystack == null || !String(haystack).includes(needle)) {
    throw new AssertionError(
      `${msg ? msg + ': ' : ''}expected ${JSON.stringify(haystack)} to contain ${JSON.stringify(needle)}`
    )
  }
}

export function notContains(haystack, needle, msg) {
  if (haystack != null && String(haystack).includes(needle)) {
    throw new AssertionError(
      `${msg ? msg + ': ' : ''}expected ${JSON.stringify(haystack)} NOT to contain ${JSON.stringify(needle)}`
    )
  }
}

export function match(str, re, msg) {
  if (str == null || !re.test(String(str))) {
    throw new AssertionError(
      `${msg ? msg + ': ' : ''}expected ${JSON.stringify(str)} to match ${re}`
    )
  }
}

export const assert = { ok, eq, notEq, contains, notContains, match }
