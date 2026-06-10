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

// Resolves which journal folders the "Today" action should offer, given the
// list of known journal folders and a predicate reporting whether each folder
// opted in (its per-folder `includeInTodayPicker`). Pure so the (slightly
// fiddly) selection rules are unit-testable in isolation from the vault.
//
// Rules:
//   - 0 known folders        → [] (nothing to open)
//   - exactly 1 known folder → that folder is ALWAYS included, regardless of
//                              its opt-in flag (a single journal needs no
//                              picker — the Today button just opens it)
//   - several known folders, none opted in → all of them (so the feature is
//                              usable out of the box before anyone configures
//                              opt-in)
//   - several known folders, some opted in → only the opted-in ones
export function resolveTodayFolders(
  knownFolders: string[],
  isIncluded: (folderPath: string) => boolean
): string[] {
  if (knownFolders.length <= 1) return knownFolders
  const included = knownFolders.filter(isIncluded)
  return included.length > 0 ? included : knownFolders
}
