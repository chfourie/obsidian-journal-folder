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

import { moment } from './moment'
import type { StartOfWeekSetting } from './journal-folder-settings.type'

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

// Cached the first time `applyStartOfWeek` runs so we can restore the locale's
// natural week settings when the user switches back to "locale default" after
// having overridden them — moment doesn't expose a clean reset.
let localeDefault: { dow: number; doy: number } | null = null

function captureLocaleDefault(): { dow: number; doy: number } {
  if (localeDefault) return localeDefault
  const data = moment.localeData()
  localeDefault = {
    dow: data.firstDayOfWeek(),
    doy: data.firstDayOfYear(),
  }
  return localeDefault
}

// `string & {}` keeps the `StartOfWeekSetting` literals in autocomplete while
// still accepting the arbitrary strings that arrive from folder front matter
// (a plain `| string` would collapse the union back to `string`).
export function resolveWeekConfig(setting: StartOfWeekSetting | (string & {})): {
  dow: number
  doy: number
} {
  const fallback = captureLocaleDefault()
  const dow = DAY_INDEX[String(setting).toLowerCase()]
  if (dow === undefined) return fallback
  // doy = dow + 6 places week 1 as the week containing January 1 — the most
  // intuitive numbering when the user has explicitly chosen a start day.
  return { dow, doy: dow + 6 }
}

export function applyStartOfWeek(setting: StartOfWeekSetting | (string & {})): void {
  const { dow, doy } = resolveWeekConfig(setting)
  moment.updateLocale(moment.locale(), { week: { dow, doy } })
}

// Test-only: forget the cached locale default so a fresh capture happens on
// the next call. The plugin code never needs this — it runs once per process.
export function _resetLocaleDefaultCache(): void {
  localeDefault = null
}
