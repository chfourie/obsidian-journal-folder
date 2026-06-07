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

// Single typed entry point for Obsidian's bundled moment.
//
// Obsidian re-exports moment as `export const moment: typeof Moment` where
// `Moment` is a namespace import (`import * as Moment from 'moment'`). Under
// this project's `esModuleInterop`, a namespace type isn't callable, so every
// `moment(...)` call against the raw obsidian export raises TS2349 ("This
// expression is not callable") — which the codebase used to silence with a
// scattering of `// @ts-ignore` comments, leaving eslint's type-checked rules
// to treat every result as an error-typed value (`no-unsafe-*`).
//
// Re-casting the value to `typeof import('moment')` recovers moment's real
// callable signature (the module's `export = moment`), so callers get a
// properly typed `Moment` everywhere with no per-call suppressions. Date
// formatting must always go through this so locale/start-of-week settings
// (applied to the bundled instance) are honoured — never `import 'moment'`
// directly, which would be a *second*, unconfigured copy.
import { moment as obsidianMoment } from 'obsidian'

export const moment = obsidianMoment as unknown as typeof import('moment')

// Derived from the typed value above rather than `import('moment')` so we
// never import the `moment` module directly (obsidianmd/no-restricted-imports —
// the bundled instance must always come through obsidian's re-export).
export type Moment = ReturnType<typeof moment>
