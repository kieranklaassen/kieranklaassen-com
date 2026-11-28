import type { Mask } from './mask'
import { Kind, type Course, type RGB, type Rect, type Wash } from './painter'
import { clamp, four, hashOf, pigment, seeded, smooth, type Random } from './pigments'

export interface PaintBox extends Rect {
  name: string
  key: string
  element: HTMLElement
}

export interface Composition {
  washes: Wash[]
  paper: RGB
  course?: Course
  mask?: Mask
}

export interface Page {
  width: number
  height: number
  shell: HTMLElement
  /** The boxes the page asks paint for, measured now. */
  boxes: () => PaintBox[]
  random: Random
  /** The name stands over a longer page, and its paint runs further. */
  long?: boolean
}

export type Compose = (page: Page) => Composition

export const PAPER: RGB = [0.972, 0.953, 0.912]

export const grown = (box: Rect, by: number): Rect => ({ x: box.x - by, y: box.y - by, w: box.w + by * 2, h: box.h + by * 2 })
export const meets = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export const of = (boxes: PaintBox[], ...names: string[]) => boxes.filter((box) => names.includes(box.name))

export function pencil(rect: Rect, random: Random): Wash {
  return { ...rect, kind: Kind.Pencil, ink: [0.4, 0.4, 0.4], ink2: [0.4, 0.4, 0.4], density: 0.8, seed: four(random), delay: 0, lasts: 900, grow: 0, still: true }
}

/** Dark enough to be read as ink, each letter a pigment of its own along one turn of the wheel. */
export function letterInk(i: number, count: number, turn: number): [RGB, RGB] {
  const at = (i / Math.max(1, count - 1)) * 1.0 + turn
  const w = 0.5 + 0.62 * Math.sin(at * 6.283)
  const light = 0.16 + 0.2 * (0.5 + 0.5 * Math.sin(i * 2.4 + turn * 9))
  return [pigment(light, w), pigment(light + 0.2, w + 0.35 * Math.cos(i * 1.7))]
}

export const NARROW = 900
const STEP = 12

/** The water comes and goes twice a day, as it does. From -1 to 1. */
export const tide = () => Math.sin((Date.now() / 3_600_000 / 12.42) * 2 * Math.PI)

export const winding = (y: number) => 0.62 * Math.sin(y / 310 + 0.6) + 0.38 * Math.sin(y / 173 + 2)

export function courseOf(height: number, at: (y: number) => [number, number]): Course {
  const step = Math.max(STEP, height / 2000)
  const points = new Float32Array((Math.ceil(height / step) + 2) * 2)
  for (let i = 0; i < points.length / 2; i++) points.set(at(i * step), i * 2)
  return { step, points }
}

export const courseAt = ({ step, points }: Course, y: number): [number, number] => {
  const last = points.length / 2 - 1
  const f = clamp(y / step, 0, last - 0.001)
  const i = Math.floor(f)
  const between = (o: number) => points[i * 2 + o] + (points[i * 2 + 2 + o] - points[i * 2 + o]) * (f - i)
  return [between(0), between(1)]
}

/** On a phone the creek goes round what is written: as wide as a paragraph, a trickle where there is none. */
export function courseRound(written: Rect[], width: number, height: number): Course {
  const count = Math.ceil(height / STEP) + 2
  const low = new Float32Array(count)
  const high = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const y = i * STEP
    const here = written.filter((box) => y > box.y - 20 && y < box.y + box.h + 20)
    const dry = width / 2 + width * 0.24 * winding(y)
    const left = Math.min(...here.map((box) => box.x))
    const right = Math.max(...here.map((box) => box.x + box.w))
    // no slivers where there is hardly room for a bank
    low[i] = !here.length ? dry - 9 : left < 70 ? -90 : left - 26
    high[i] = !here.length ? dry + 9 : right > width - 70 ? width + 90 : right + 26
  }
  const eased = (line: Float32Array) =>
    line.map((_, i) => {
      let sum = 0
      let weight = 0
      for (let k = -3; k <= 3; k++) {
        const j = clamp(i + k, 0, count - 1)
        const w = 4 - Math.abs(k)
        sum += line[j] * w
        weight += w
      }
      return sum / weight
    })
  const [left, right] = [eased(low), eased(high)]
  const points = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) points.set([(left[i] + right[i]) / 2, (right[i] - left[i]) / 2], i * 2)
  return { step: STEP, points }
}

export interface Tone {
  light: number
  warmth: number
  goes: number
}

/** Every thought has a color of its own: in the score, beside its title and on the banks of its page. */
export function toneOf(key: string): Tone {
  const own = seeded(hashOf(key))
  const warmth = own() < 0.5 ? own() * 0.3 : 0.7 + own() * 0.3
  return { warmth, light: 0.04 + 0.42 * own(), goes: warmth + 0.5 * (own() - 0.5) }
}

export function noteInk(key: string): [RGB, RGB] {
  const tone = toneOf(key)
  return [pigment(tone.light, tone.warmth), pigment(tone.light + 0.16, tone.goes)]
}

interface Shore {
  width: number
  /** The banks lie from here to here. */
  top: number
  foot: number
  course: Course
  random: Random
  /** The piece whose page it is gives the banks its color. */
  tone?: Tone
}

export function banks({ width, top, foot, course, random, tone }: Shore): Wash[] {
  const washes: Wash[] = []
  const narrow = width < NARROW
  const turn = random() * 6
  let y = top - 90
  while (y < foot) {
    const rowH = (narrow ? 30 : 48) + (narrow ? 16 : 30) * random()
    const rowSeed = random()
    let x = -40 - 80 * random()
    while (x < width + 20) {
      const w = (narrow ? 60 : 90) + (narrow ? 90 : 200) * random()
      const cx = x + w / 2
      const cy = y + rowH / 2
      const [middle, half] = courseAt(course, cy + 30)
      const bank = Math.abs(cx - middle) - half
      const light = clamp(0.98 - 0.92 * smooth(-40, narrow ? 170 : Math.max(150, width / 2 - half), bank) + (random() - 0.5) * 0.36)
      const wide = 0.5 + 0.36 * Math.sin((cx / 900) * 2.1 - (cy / 900) * 2.2 + turn) + (random() - 0.5) * 0.8
      const warmth = tone ? tone.warmth + (wide - 0.5) * 0.3 : wide
      if (bank + w / 2 > -70)
        washes.push({
          x, y, w: w - 5, h: rowH,
          kind: Kind.Bank,
          ink: pigment(light, warmth),
          ink2: pigment(clamp(light + 0.08), (tone ? tone.warmth + (wide - 0.5) * 0.7 : warmth) + 0.4 * (random() - 0.5)),
          density: 0.8 + 0.42 * random(),
          seed: [rowSeed, random(), random(), random()],
          extra: [0, 1, 0, 0],
          from: [cx < middle ? 0 : 1, 0.5],
          delay: 0.45 * Math.max(0, cy - top) + 350 * random(),
          lasts: 1500,
          grow: 0,
        })
      x += w
    }
    y += rowH * 0.98
  }
  return washes
}

/** What is written in the stream, for a creek that goes round it. */
export function writtenIn(boxes: PaintBox[], shell: HTMLElement): Rect[] {
  const from = shell.getBoundingClientRect()
  const blocks = [...shell.querySelectorAll<HTMLElement>('.wc-prose > *, .wc-sheet > header > *, .wc-back')].map((element) => {
    const box = element.getBoundingClientRect()
    return { x: box.left - from.left, y: box.top - from.top, w: box.width, h: box.height }
  })
  return [...of(boxes, 'name', 'intro', 'nav', 'heading', 'card', 'repo', 'title', 'staff', 'quiet', ...(blocks.length ? [] : ['sheet'])), ...blocks]
}

export function wander(shell: HTMLElement, middle: (y: number) => number, width: number) {
  const from = shell.getBoundingClientRect()
  const all = [...shell.querySelectorAll<HTMLElement>('[data-wander]')]
  for (const element of all) element.style.translate = ''
  for (const element of all) {
    const box = element.getBoundingClientRect()
    element.style.translate = `${(middle(box.top - from.top + box.height / 2) - width / 2).toFixed(1)}px 0`
  }
}

export const still = (shell: HTMLElement) => {
  for (const element of shell.querySelectorAll<HTMLElement>('[data-wander]')) element.style.translate = ''
}
