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

// Curated shortcut list shown in the Lucide picker when no search
// term is active. Picked for affinity with task statuses (checks,
// arrows, flags, clocks, alerts). The full set is loaded from
// Obsidian's icon registry on demand via `getIconIds()`.
export const COMMON_LUCIDE_ICONS: string[] = [
  'check',
  'check-check',
  'x',
  'minus',
  'plus',
  'circle',
  'circle-dot',
  'dot',
  'square',
  'square-check',
  'square-x',
  'clock',
  'hourglass',
  'pause',
  'play',
  'redo-2',
  'undo-2',
  'corner-up-right',
  'corner-down-right',
  'arrow-right',
  'arrow-up-right',
  'arrow-down-right',
  'flag',
  'flag-triangle-right',
  'star',
  'sparkles',
  'pin',
  'bookmark',
  'bell',
  'alert-triangle',
  'alert-circle',
  'help-circle',
  'info',
  'eye',
  'eye-off',
  'lock',
  'unlock',
  'user-round',
  'users',
  'message-circle',
  'inbox',
  'archive',
  'trash-2',
  'send',
  'forward',
  'reply',
  'zap',
  'heart',
  'thumbs-up',
  'thumbs-down',
]

export type EmojiEntry = {
  emoji: string
  // Lowercase search keywords. The first entry doubles as the
  // tooltip / aria-label for the grid cell.
  keywords: string[]
}

// Larger curated emoji palette (~180) covering common signalling
// glyphs across checkbox shapes, task flow, faces, weather, hands,
// hearts, symbols, and objects. Keywords drive the search filter
// — they're deliberately simple (single words a user is likely to
// type) and include synonyms where useful.
//
// Not exhaustive — the full Unicode emoji set runs to thousands.
// For anything outside this list, paste directly into the custom
// field or use the OS emoji picker (Cmd+Ctrl+Space on macOS,
// Win+. on Windows).
export const COMMON_EMOJI: EmojiEntry[] = [
  // ----- checkbox / status glyphs --------------------------------
  { emoji: '✓', keywords: ['check', 'tick', 'done', 'yes'] },
  { emoji: '✔', keywords: ['check heavy', 'tick', 'done'] },
  { emoji: '✗', keywords: ['cross', 'x', 'no', 'cancel'] },
  { emoji: '✘', keywords: ['cross heavy', 'x', 'no'] },
  { emoji: '☑', keywords: ['checkbox checked', 'ballot check', 'done'] },
  { emoji: '☒', keywords: ['checkbox crossed', 'ballot x', 'cancel'] },
  { emoji: '☐', keywords: ['checkbox empty', 'open', 'todo'] },
  { emoji: '◯', keywords: ['circle', 'open', 'ring'] },
  { emoji: '●', keywords: ['circle filled', 'dot'] },
  { emoji: '○', keywords: ['circle small', 'open'] },
  { emoji: '◐', keywords: ['half circle', 'in progress', 'partial'] },
  { emoji: '◑', keywords: ['half circle', 'in progress'] },
  { emoji: '◒', keywords: ['half circle', 'partial'] },
  { emoji: '◓', keywords: ['half circle', 'partial'] },
  { emoji: '◔', keywords: ['quarter circle', 'progress'] },
  { emoji: '◕', keywords: ['three quarter circle', 'progress'] },
  { emoji: '■', keywords: ['square filled', 'done'] },
  { emoji: '□', keywords: ['square empty', 'open'] },
  { emoji: '▣', keywords: ['square nested', 'progress'] },
  { emoji: '▢', keywords: ['square rounded'] },
  { emoji: '◆', keywords: ['diamond', 'highlight'] },
  { emoji: '◇', keywords: ['diamond open'] },
  { emoji: '▲', keywords: ['triangle up', 'priority high'] },
  { emoji: '▼', keywords: ['triangle down', 'priority low'] },
  { emoji: '►', keywords: ['triangle right', 'play', 'next'] },
  { emoji: '◄', keywords: ['triangle left', 'back'] },

  // ----- task flow arrows ---------------------------------------
  { emoji: '➡', keywords: ['arrow right', 'next', 'forward'] },
  { emoji: '⬅', keywords: ['arrow left', 'back'] },
  { emoji: '⬆', keywords: ['arrow up'] },
  { emoji: '⬇', keywords: ['arrow down'] },
  { emoji: '↩', keywords: ['arrow back', 'reply', 'undo'] },
  { emoji: '↪', keywords: ['arrow forward', 'redo'] },
  { emoji: '🔁', keywords: ['repeat', 'cycle', 'loop'] },
  { emoji: '🔃', keywords: ['refresh', 'reload'] },
  { emoji: '🔄', keywords: ['sync', 'rotate', 'recycle'] },
  { emoji: '▶', keywords: ['play', 'start', 'go'] },
  { emoji: '⏸', keywords: ['pause', 'hold'] },
  { emoji: '⏹', keywords: ['stop'] },
  { emoji: '⏺', keywords: ['record', 'dot'] },
  { emoji: '⏩', keywords: ['fast forward', 'next'] },
  { emoji: '⏪', keywords: ['rewind', 'back'] },
  { emoji: '⏭', keywords: ['next', 'skip'] },
  { emoji: '⏮', keywords: ['previous', 'back'] },
  { emoji: '⏏', keywords: ['eject'] },

  // ----- highlight / priority -----------------------------------
  { emoji: '⭐', keywords: ['star', 'favourite', 'priority'] },
  { emoji: '🌟', keywords: ['star glowing', 'highlight'] },
  { emoji: '✨', keywords: ['sparkles', 'new', 'shine'] },
  { emoji: '🔥', keywords: ['fire', 'hot', 'urgent'] },
  { emoji: '⚡', keywords: ['zap', 'lightning', 'fast'] },
  { emoji: '🚀', keywords: ['rocket', 'launch', 'fast'] },
  { emoji: '💯', keywords: ['hundred', 'perfect', 'done'] },
  { emoji: '🎯', keywords: ['target', 'goal', 'focus'] },
  { emoji: '🏁', keywords: ['flag finish', 'done'] },
  { emoji: '🏆', keywords: ['trophy', 'win', 'achievement'] },
  { emoji: '🎉', keywords: ['celebrate', 'party', 'done'] },
  { emoji: '🎊', keywords: ['celebrate', 'confetti'] },

  // ----- time -----------------------------------------------------
  { emoji: '⏰', keywords: ['alarm', 'clock', 'reminder'] },
  { emoji: '⏱', keywords: ['stopwatch', 'timer'] },
  { emoji: '⏲', keywords: ['timer'] },
  { emoji: '⌛', keywords: ['hourglass done', 'waiting'] },
  { emoji: '⏳', keywords: ['hourglass flowing', 'waiting', 'pending'] },
  { emoji: '🕐', keywords: ['clock 1', 'time'] },
  { emoji: '📅', keywords: ['calendar', 'date', 'schedule'] },
  { emoji: '📆', keywords: ['calendar tear off', 'date'] },
  { emoji: '🗓', keywords: ['spiral calendar', 'planner'] },
  { emoji: '📌', keywords: ['pin', 'pinned'] },
  { emoji: '📍', keywords: ['location', 'pin'] },

  // ----- notes / docs --------------------------------------------
  { emoji: '📝', keywords: ['note', 'memo', 'write'] },
  { emoji: '📋', keywords: ['clipboard', 'list'] },
  { emoji: '📄', keywords: ['document', 'page'] },
  { emoji: '📃', keywords: ['document curled'] },
  { emoji: '📑', keywords: ['bookmark tabs', 'index'] },
  { emoji: '📒', keywords: ['notebook ledger'] },
  { emoji: '📓', keywords: ['notebook'] },
  { emoji: '📔', keywords: ['notebook decorated'] },
  { emoji: '📕', keywords: ['book closed', 'red'] },
  { emoji: '📗', keywords: ['book green'] },
  { emoji: '📘', keywords: ['book blue'] },
  { emoji: '📙', keywords: ['book orange'] },
  { emoji: '📚', keywords: ['books', 'library'] },
  { emoji: '📰', keywords: ['newspaper', 'news'] },
  { emoji: '🔖', keywords: ['bookmark'] },
  { emoji: '🏷', keywords: ['label', 'tag'] },

  // ----- inbox / send --------------------------------------------
  { emoji: '📥', keywords: ['inbox', 'incoming'] },
  { emoji: '📤', keywords: ['outbox', 'outgoing'] },
  { emoji: '📦', keywords: ['package', 'box'] },
  { emoji: '📨', keywords: ['envelope incoming', 'mail'] },
  { emoji: '📩', keywords: ['envelope outgoing', 'send'] },
  { emoji: '✉', keywords: ['envelope', 'mail'] },
  { emoji: '📧', keywords: ['email', 'mail'] },
  { emoji: '💬', keywords: ['speech', 'message', 'chat'] },
  { emoji: '🗨', keywords: ['speech bubble'] },
  { emoji: '🗯', keywords: ['speech sharp', 'shout'] },
  { emoji: '📞', keywords: ['phone', 'call'] },
  { emoji: '📲', keywords: ['mobile call'] },

  // ----- alerts / status ----------------------------------------
  { emoji: '❗', keywords: ['exclamation', 'important', 'urgent'] },
  { emoji: '❕', keywords: ['exclamation white'] },
  { emoji: '❓', keywords: ['question', 'help', 'unknown'] },
  { emoji: '❔', keywords: ['question white'] },
  { emoji: '⚠', keywords: ['warning', 'alert'] },
  { emoji: '🚧', keywords: ['construction', 'wip', 'in progress'] },
  { emoji: '🚫', keywords: ['prohibited', 'no', 'cancelled'] },
  { emoji: '⛔', keywords: ['no entry', 'stop'] },
  { emoji: '🛑', keywords: ['stop sign', 'halt'] },
  { emoji: '⏯', keywords: ['play pause'] },
  { emoji: '🔔', keywords: ['bell', 'notification'] },
  { emoji: '🔕', keywords: ['bell muted', 'silent'] },
  { emoji: '🔇', keywords: ['speaker mute'] },
  { emoji: '🔊', keywords: ['speaker loud'] },
  { emoji: '📢', keywords: ['loudspeaker', 'announce'] },
  { emoji: '📣', keywords: ['megaphone', 'shout'] },

  // ----- people / roles -----------------------------------------
  { emoji: '👤', keywords: ['user', 'person'] },
  { emoji: '👥', keywords: ['users', 'people', 'team'] },
  { emoji: '🧑', keywords: ['person'] },
  { emoji: '👋', keywords: ['wave', 'hello'] },
  { emoji: '👍', keywords: ['thumbs up', 'yes', 'good'] },
  { emoji: '👎', keywords: ['thumbs down', 'no', 'bad'] },
  { emoji: '✋', keywords: ['hand raised', 'stop'] },
  { emoji: '🤝', keywords: ['handshake', 'agree', 'deal'] },
  { emoji: '👏', keywords: ['clap', 'applause'] },
  { emoji: '🙏', keywords: ['pray', 'thanks', 'please'] },
  { emoji: '👀', keywords: ['eyes', 'looking', 'watch'] },
  { emoji: '🧠', keywords: ['brain', 'think'] },

  // ----- emotions ------------------------------------------------
  { emoji: '😀', keywords: ['smile', 'happy'] },
  { emoji: '😊', keywords: ['smile blush', 'happy'] },
  { emoji: '😎', keywords: ['cool', 'sunglasses'] },
  { emoji: '🤔', keywords: ['thinking', 'consider'] },
  { emoji: '😴', keywords: ['sleep', 'tired'] },
  { emoji: '😅', keywords: ['relief', 'phew'] },
  { emoji: '😢', keywords: ['cry', 'sad'] },
  { emoji: '😡', keywords: ['angry', 'mad'] },
  { emoji: '🤯', keywords: ['mind blown', 'wow'] },

  // ----- hearts --------------------------------------------------
  { emoji: '❤', keywords: ['heart red', 'love', 'favourite'] },
  { emoji: '🧡', keywords: ['heart orange'] },
  { emoji: '💛', keywords: ['heart yellow'] },
  { emoji: '💚', keywords: ['heart green'] },
  { emoji: '💙', keywords: ['heart blue'] },
  { emoji: '💜', keywords: ['heart purple'] },
  { emoji: '🖤', keywords: ['heart black'] },
  { emoji: '🤍', keywords: ['heart white'] },
  { emoji: '💔', keywords: ['heart broken'] },

  // ----- nature / weather ---------------------------------------
  { emoji: '☀', keywords: ['sun', 'sunny'] },
  { emoji: '🌤', keywords: ['sun cloud'] },
  { emoji: '⛅', keywords: ['cloud sun'] },
  { emoji: '☁', keywords: ['cloud'] },
  { emoji: '🌧', keywords: ['rain'] },
  { emoji: '⛈', keywords: ['storm'] },
  { emoji: '❄', keywords: ['snow', 'cold'] },
  { emoji: '🌈', keywords: ['rainbow'] },
  { emoji: '🌙', keywords: ['moon', 'night'] },
  { emoji: '☂', keywords: ['umbrella'] },

  // ----- tech / tools -------------------------------------------
  { emoji: '💡', keywords: ['idea', 'lightbulb'] },
  { emoji: '🔍', keywords: ['search', 'find'] },
  { emoji: '🔎', keywords: ['search right'] },
  { emoji: '🔧', keywords: ['wrench', 'fix'] },
  { emoji: '🔨', keywords: ['hammer', 'build'] },
  { emoji: '🛠', keywords: ['tools'] },
  { emoji: '⚙', keywords: ['settings', 'gear', 'config'] },
  { emoji: '🔑', keywords: ['key', 'access'] },
  { emoji: '🔒', keywords: ['lock', 'secure'] },
  { emoji: '🔓', keywords: ['unlock'] },
  { emoji: '🔗', keywords: ['link'] },
  { emoji: '📎', keywords: ['paperclip', 'attach'] },
  { emoji: '🖇', keywords: ['paperclips'] },
  { emoji: '✂', keywords: ['scissors', 'cut'] },
  { emoji: '🗑', keywords: ['trash', 'bin', 'delete'] },
  { emoji: '🗂', keywords: ['folder dividers'] },
  { emoji: '📁', keywords: ['folder'] },
  { emoji: '📂', keywords: ['folder open'] },

  // ----- finance / shop -----------------------------------------
  { emoji: '💰', keywords: ['money', 'bag'] },
  { emoji: '💸', keywords: ['money flying', 'spend'] },
  { emoji: '💳', keywords: ['credit card'] },
  { emoji: '🛒', keywords: ['shopping cart'] },
  { emoji: '🛍', keywords: ['shopping bags'] },

  // ----- misc useful --------------------------------------------
  { emoji: '🍕', keywords: ['pizza', 'food'] },
  { emoji: '☕', keywords: ['coffee', 'drink'] },
  { emoji: '🍵', keywords: ['tea'] },
  { emoji: '🎁', keywords: ['gift', 'present'] },
  { emoji: '🎵', keywords: ['music note'] },
  { emoji: '🎶', keywords: ['music notes'] },
  { emoji: '🚗', keywords: ['car'] },
  { emoji: '🏠', keywords: ['home', 'house'] },
  { emoji: '🏥', keywords: ['hospital'] },
  { emoji: '🏫', keywords: ['school'] },
  { emoji: '🏢', keywords: ['office'] },
]
