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

// Thin wrapper around the Obsidian CLI (`obsidian <command> …`). Every call
// targets the e2e vault by name and runs with a hard timeout, because an
// `eval` bound to a wedged / wrong-focus Obsidian window will otherwise hang
// the whole suite (a real-world trap — see tests/e2e/README.md). On timeout
// we kill the child and surface a clear error instead of blocking forever.

import { execFile, execFileSync } from 'node:child_process'

// The committed e2e vault's registered CLI name is its folder basename.
// Overridable so the suite can be pointed at another vault for debugging.
export const VAULT = process.env.JF_E2E_VAULT || 'jf-e2e-vault'

const DEFAULT_TIMEOUT_MS = Number(process.env.JF_E2E_TIMEOUT_MS || 20000)

// Run the Obsidian CLI with the given args (no shell — each element is one
// argv, so JS payloads in `code=…` need no escaping). Resolves with stdout,
// rejects on non-zero exit or timeout.
export function obs(args, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'obsidian',
      args,
      { encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL' },
      (err, stdout, stderr) => {
        if (err) {
          if (err.killed) {
            reject(
              new Error(
                `obsidian ${args[0]} timed out after ${timeoutMs}ms — is the ` +
                  `'${VAULT}' vault open and focused? (see tests/e2e/README.md)`
              )
            )
            return
          }
          reject(new Error(`obsidian ${args.join(' ')} failed: ${stderr || err.message}`))
          return
        }
        resolve(stdout)
      }
    )
    child.on('error', reject)
  })
}

// Strip the CLI's `=> ` result marker.
function stripMarker(out) {
  return out.replace(/^=>\s?/, '').replace(/\s+$/, '')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Re-focus the target vault's window. The CLI binds to the focused window, so
// after a timeout (the window lost focus / was briefly busy) bringing it back
// to front lets the retry land. macOS-only; a no-op elsewhere.
function refocus() {
  try {
    execFileSync('open', [`obsidian://open?vault=${encodeURIComponent(VAULT)}`])
  } catch {
    /* non-macOS: caller must keep the window focused */
  }
}

// Run an `obs` call, retrying ONCE on timeout after re-focusing the window —
// the single most common transient (a momentary focus change wedges one eval).
async function obsWithRetry(args, opts) {
  try {
    return await obs(args, opts)
  } catch (e) {
    if (!/timed out/.test(e.message)) throw e
    refocus()
    await sleep(1200)
    return obs(args, opts)
  }
}

// `eval` a raw JS expression in the app, returning the printed result string.
// `app` is in scope; promises are awaited by the CLI.
//
// Empty stdout is a transient, not a real result: the CLI prints `=> <value>`
// for every expression (even `undefined`), so a blank reply means the bound
// window was mid-repaint / busy when the eval landed (e.g. just after a
// `dev:screenshot` focus change). An empty parse then surfaces downstream as
// "Unexpected end of JSON input". Refocus and retry once before giving up — the
// same single-retry posture as the timeout path in obsWithRetry.
export async function evalRaw(code, opts) {
  const args = [`vault=${VAULT}`, 'eval', `code=${oneLine(code)}`]
  // Backoff between empty-stdout retries. A heavy re-render (e.g. toggling a
  // setting that rebuilds every view) can keep the window busy across more than
  // one quick retry, so escalate the wait rather than giving up after one.
  const backoff = [300, 500, 800, 1200]
  for (let attempt = 0; ; attempt++) {
    const stripped = stripMarker(await obsWithRetry(args, opts))
    if (stripped !== '' || attempt >= backoff.length) return stripped
    refocus()
    await sleep(backoff[attempt])
  }
}

// `eval` JS that produces a JSON-encodable value (or a Promise of one) and
// parse it here so structured results survive the CLI's text transport intact.
// We `Promise.resolve(...).then(JSON.stringify)` so the CLI awaits the value
// BEFORE stringifying — stringifying an un-awaited Promise yields "{}".
export async function evalJSON(code, opts) {
  const wrapped = `Promise.resolve((${oneLine(code)})).then((v)=>JSON.stringify(v))`
  const raw = await evalRaw(wrapped, opts)
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`eval did not return JSON. Got: ${raw}`)
  }
}

// Collapse newlines so a multi-line template literal survives as one CLI
// value. Injected code therefore must not use `//` line comments — use block
// comments or none. (Mirrors scripts/screenshots/capture.mjs.)
export function oneLine(code) {
  return String(code).replace(/\r?\n/g, ' ')
}

// Run a CLI command that returns plain text (open/read/plugin:reload/…).
export async function command(args, opts) {
  return obsWithRetry([`vault=${VAULT}`, ...args], opts)
}

// The floor both harnesses hold the Obsidian window to. Obsidian remembers a
// window size per vault, so a vault last used at 1024x800 comes back that
// small — which silently degrades every capture: the in-note calendar collapses
// to fewer months, the sidebar eats most of the note width, and cropped rects
// land on a layout no reader will ever see. Screenshots and geometry
// assertions are only meaningful at a realistic desktop size, so assert one
// rather than trusting whatever the window happens to be.
//
// Override with e.g. `JF_WINDOW_SIZE=1440x900`. Values are a MINIMUM: a window
// already larger is left exactly as the user arranged it.
const [ENV_W, ENV_H] = String(process.env.JF_WINDOW_SIZE || '').split('x').map(Number)
export const MIN_WINDOW = {
  width: Number.isFinite(ENV_W) && ENV_W > 0 ? ENV_W : 1600,
  height: Number.isFinite(ENV_H) && ENV_H > 0 ? ENV_H : 1050,
}

// Grow the focused vault window to at least MIN_WINDOW (clamped to the screen's
// available area and centred on it), and report what happened. Never throws and
// never fails a run: a window that can't be resized — fullscreen, or an Electron
// build without `remote` — still produces valid, if smaller, output, so the
// caller warns and carries on.
export async function ensureWindowSize(min = MIN_WINDOW) {
  // Semicolons are load-bearing here: `oneLine` collapses this to a single
  // line, and the repo's semicolon-free style would then run statements
  // together ("Unexpected token 'const'"). Same reason `//` comments are banned
  // in injected code.
  const code = `(()=>{
    try {
      const avail = { width: activeWindow.screen.availWidth, height: activeWindow.screen.availHeight };
      const before = { width: activeWindow.innerWidth, height: activeWindow.innerHeight };
      const want = { width: Math.min(${min.width}, avail.width), height: Math.min(${min.height}, avail.height) };
      if (before.width >= want.width && before.height >= want.height) return { ok: true, resized: false, before, want };
      const win = require('electron').remote.getCurrentWindow();
      if (win.isFullScreen()) return { ok: false, resized: false, before, want, reason: 'fullscreen' };
      if (win.isMaximized()) return { ok: true, resized: false, before, want };
      const bounds = win.getBounds();
      const width = want.width + (bounds.width - before.width);
      const height = want.height + (bounds.height - before.height);
      win.setBounds({
        x: Math.max(0, Math.round((avail.width - width) / 2)),
        y: Math.max(0, Math.round((avail.height - height) / 2)),
        width: width, height: height,
      });
      return { ok: true, resized: true, before, want };
    } catch (e) {
      return { ok: false, resized: false, reason: String(e && e.message ? e.message : e) };
    }
  })()`

  let result
  try {
    result = await evalJSON(code)
  } catch (e) {
    return { ok: false, resized: false, reason: e.message }
  }
  if (!result.resized) return result

  // setBounds is asynchronous at the OS level — the renderer's innerWidth still
  // reads the old value on the same tick, so re-read after the resize settles
  // and report the size layout actually ran at.
  await sleep(500)
  try {
    const after = await evalJSON(
      `({ width: activeWindow.innerWidth, height: activeWindow.innerHeight })`
    )
    return { ...result, after }
  } catch {
    return result
  }
}
