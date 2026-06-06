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

// Date helpers for the (Node-side) runner. The runner is plain Node executed
// by the user, so `new Date()` is fine here (unlike Workflow scripts). Only
// the daily YYYY-MM-DD basename is computed locally — it matches the plugin's
// `YYYY-MM-DD` daily pattern and Obsidian's local-time moment for that format.

function pad(n) {
  return String(n).padStart(2, '0')
}

// Today's daily-note basename in LOCAL time (YYYY-MM-DD).
export function todayDaily(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// A daily basename N days from today (negative = past), local time.
export function dailyOffset(days, base = new Date()) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return todayDaily(d)
}
