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

import { describe, expect, it } from 'vitest'
import { indentDepth } from '../../../src/features/journal-signifiers/signifier-live-preview'

describe('indentDepth', () => {
  it('treats a top-level list line as depth 1 (matches reading-view listDepth)', () => {
    expect(indentDepth('- a task #important', 4)).toBe(1)
  })

  it('counts each leading tab as one nesting level', () => {
    expect(indentDepth('\t- nested #important', 4)).toBe(2)
    expect(indentDepth('\t\t- deeper #important', 4)).toBe(3)
  })

  it('counts every `tabSize` leading spaces as one nesting level', () => {
    expect(indentDepth('    - nested #important', 4)).toBe(2)
    expect(indentDepth('        - deeper #important', 4)).toBe(3)
    // A partial group does not advance a level.
    expect(indentDepth('      - one-and-a-half #important', 4)).toBe(2)
  })

  it('honours a non-default tab size', () => {
    expect(indentDepth('  - nested #important', 2)).toBe(2)
  })
})
