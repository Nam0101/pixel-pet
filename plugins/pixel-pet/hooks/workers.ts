import { BODY_W, HEIGHT, MAX_MINIS, drawMini, stamp } from './pixels'
import type { Body, Canvas, MiniView } from './pixels'

/**
 * One subagent's mini on the band, at column `x`. `lift` is its height off the ground: the arc of the pet's throw,
 * then a typist's bob at its desk. `isSeated` once it has landed at its station, where its desk stands.
 */
export type Worker = { x: number; k: number; view: MiniView; lift?: number; isSeated: boolean }

/** How long a mini flies from the pet to its station when its subagent starts. */
export const THROW_MS = 700
const THROW_H = 9 // pixels, at the top of the arc
const TYPE_MS = 160 // a typing mini bobs one pixel this often
const BLINK_MS = 320 // the desk's screen changes this often

// The desk a worker types at: a monitor on a table, with the keyboard at the near edge. The mod's own drawing, in mid
// tones. It is drawn over the mini, so the keyboard lies across the mini's middle, under its hands.
const DESK = ['...MMMMMMM', '...MnnnnnM', '...MnnnnnM', '...MMMMMMM', '......M...', 'kkkddddddd', '.E......E.', '.E......E.']
const DESK_COLORS = { M: 0x5a5f70, n: 0x1f2a44, d: 0x8a6a4a, E: 0x6f533a, k: 0xc5c8d2 }
const CODE = [0x7cc47a, 0xf2c230, 0x8fc7ea]
const SCREEN = { x: 4, y: 1, w: 5, h: 2 } // the screen's pixels within DESK
const DESK_AT = 3 // the desk starts this many columns into the mini, which sits at its near edge
/** The columns one station takes: the mini and its desk, overlapping at the keyboard. */
export const STATION_W = DESK_AT + (DESK[0] as string).length
const STATION_EVERY = STATION_W + 3
const EDGE = 2 // columns kept clear at the band's right edge

/** The column where worker `k` sits: stations run in from the band's right edge. */
export const station = (k: number, width: number) => Math.max(0, width - EDGE - STATION_W - k * STATION_EVERY)

/**
 * The minis as workers on a band `width` columns wide, with the pet at column `petLeft`. The pet hands each new one
 * its task: the mini flies from the pet to its station in an arc, then types at the desk there until its subagent
 * ends.
 */
export function workersOnBand(views: MiniView[], petLeft: number, width: number): Worker[] {
  const from = petLeft + Math.floor(BODY_W / 2)

  return views.slice(0, MAX_MINIS).map((view, k) => {
    const to = station(k, width)
    if (view.age >= THROW_MS) {
      // A finished mini leaves with its own hop; a working one bobs as it types.
      return view.doneFor === undefined ? { x: to, k, view, lift: Math.floor(view.age / TYPE_MS) % 2, isSeated: true } : { x: to, k, view, isSeated: true }
    }
    const p = Math.max(0, view.age) / THROW_MS

    return { x: Math.round(from + (to - from) * p), k, view, lift: Math.round(Math.sin(p * Math.PI) * THROW_H), isSeated: false }
  })
}

/** Draws the workers on `c`, whose bottom row of pet pixels is row HEIGHT - 1: each seated one at its desk, code moving on the screen. */
export function drawWorkers(c: Canvas, workers: Worker[], body: Body) {
  for (const w of workers) {
    drawMini(c, w.x, w.view, w.k, body, w.lift)
    if (!w.isSeated) {
      continue
    }
    const ox = w.x + DESK_AT
    const oy = HEIGHT - DESK.length
    stamp(c, ox, oy, DESK, DESK_COLORS)
    if (w.view.doneFor !== undefined) {
      continue
    }
    // Lines of code of uneven length, a new one each beat.
    const beat = Math.floor(w.view.age / BLINK_MS) + w.k
    for (let line = 0; line < SCREEN.h; line++) {
      const length = 2 + ((beat + line * 2) % (SCREEN.w - 1))
      stamp(c, ox + SCREEN.x, oy + SCREEN.y + line, ['c'.repeat(length)], { c: CODE[(beat + line) % CODE.length] as number })
    }
  }
}
