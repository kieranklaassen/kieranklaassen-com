import { lettersOf, type Letter } from './letters'
import { Cutter, type Mask } from './mask'
import { Kind, type Course, type RGB, type Rect, type Wash } from './painter'
import { plate } from './picture'
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

/** What is left of `cell` beside every rectangle in `taken`: the largest piece each time. */
export function beside(cell: Rect, taken: Rect[], least: number): Rect | undefined {
  let left = cell
  for (const t of taken) {
    if (!meets(left, t)) continue
    const pieces: Rect[] = [
      { x: left.x, y: left.y, w: t.x - left.x, h: left.h },
      { x: t.x + t.w, y: left.y, w: left.x + left.w - t.x - t.w, h: left.h },
      { x: left.x, y: left.y, w: left.w, h: t.y - left.y },
      { x: left.x, y: t.y + t.h, w: left.w, h: left.y + left.h - t.y - t.h },
    ]
    left = pieces.reduce((best, piece) => (piece.w > 0 && piece.h > 0 && piece.w * piece.h > Math.max(0, best.w * best.h) ? piece : best), { x: 0, y: 0, w: 0, h: 0 })
    if (left.w < least || left.h < least) return undefined
  }
  return left.w < least || left.h < least ? undefined : left
}

export const of = (boxes: PaintBox[], ...names: string[]) => boxes.filter((box) => names.includes(box.name))

// ---------------------------------------------------------------------------------------------
// The page is the painting: every card is an oblong of the picture, and small squares lie around.

// Pale enough to be written on. Each is a pigment and what it goes to as it dries.
const TINTS: [RGB, RGB][] = [
  [[0.98, 0.84, 0.58], [0.97, 0.74, 0.56]], // straw to peach
  [[0.72, 0.84, 0.82], [0.8, 0.86, 0.68]], // sea to sage
  [[0.95, 0.72, 0.6], [0.98, 0.83, 0.6]], // coral to straw
  [[0.76, 0.79, 0.9], [0.86, 0.78, 0.86]], // a cold blue to mauve
  [[0.8, 0.86, 0.62], [0.96, 0.9, 0.66]], // sage to lemon
  [[0.9, 0.76, 0.8], [0.96, 0.82, 0.68]], // rose to sand
  [[0.7, 0.82, 0.88], [0.76, 0.8, 0.88]], // rain
]

export const smallSquares: Compose = ({ width, height, boxes: measure, random }) => {
  const boxes = measure()
  const washes: Wash[] = []
  const middle = width / 2
  const narrow = width < 700
  const turn = random() * 6
  const warmth = (x: number, y: number) => 0.46 + 0.34 * Math.sin((x / 900) * 2.3 - (y / 900) * 3.1 + turn)
  const cards = of(boxes, 'card', 'repo', 'sheet')
  const bare = of(boxes, 'name', 'intro', 'heading', 'nav')
  const bands = of(boxes, 'band')
  const taken = [...cards.map((box) => grown(box, 7)), ...bare.map((box) => grown(box, narrow ? 8 : 14))]

  let tintOf = 0
  const tintAt = Math.floor(random() * TINTS.length)
  for (const card of cards) {
    const own = seeded(hashOf(card.key))
    const sheet = card.name === 'sheet'
    const tint = TINTS[(tintAt + tintOf++ * 3) % TINTS.length]
    washes.push({
      ...card,
      kind: Kind.Square,
      ink: sheet ? [0.985, 0.93, 0.78] : tint[0],
      ink2: sheet ? [0.96, 0.9, 0.84] : tint[1],
      density: sheet ? 0.3 : 0.72 + 0.2 * own(),
      seed: four(own),
      extra: [0, 0.8, 0, 0],
      from: [own(), own()],
      delay: 420 + 500 * random(),
      lasts: 1700,
      grow: 0,
    })
  }

  // The net. Rows are cut to heights of their own, and each is cut into squares and oblongs.
  const unit = narrow ? 62 : 112
  const inside = (cell: Rect) => !narrow || bands.some((band) => meets(cell, band))
  let y = narrow ? 4 : 12
  const edgeX = narrow ? 6 : 14
  while (y < height - 30) {
    const rowH = unit * (0.5 + 0.62 * random())
    let x = edgeX + unit * 0.1 * (random() - 0.5)
    while (x < width - edgeX - 18) {
      let cellW = unit * (0.34 + 0.75 * random())
      if (random() < 0.16) cellW *= 1.7
      if (x + cellW > width - edgeX) cellW = width - edgeX - x
      if (width - edgeX - x - cellW < 26) cellW = width - edgeX - x
      const gap = 2.6
      const whole = { x: x + gap, y: y + gap, w: cellW - gap * 2, h: rowH - gap * 2 }
      x += cellW
      const cut = random()
      const halves: Rect[] =
        cut > 0.84
          ? [
              { ...whole, h: whole.h * 0.44 - 3 },
              { ...whole, y: whole.y + whole.h * 0.44 + 3, h: whole.h * 0.56 - 3 },
            ]
          : cut < 0.1 && whole.w > 50
            ? [
                { ...whole, w: whole.w * 0.42 - 3 },
                { ...whole, x: whole.x + whole.w * 0.42 + 3, w: whole.w * 0.58 - 3 },
              ]
            : [whole]
      halves.forEach((part, odd) => {
        const cell = beside(part, taken, narrow ? 14 : 18)
        if (!cell || !inside(cell)) return
        const cx = cell.x + cell.w / 2
        const cy = cell.y + cell.h / 2
        const away = Math.abs(cx - middle) / (width / 2)
        const foot = smooth(height - 420, height, cy)
        const light = clamp(1.12 - 0.98 * Math.pow(away, narrow ? 0.9 : 1.25) - 0.5 * foot * (0.4 + 0.6 * away) + (random() - 0.5) * 0.3 + (odd - 0.5) * 0.08)
        const w = warmth(cx, cy) + (odd - 0.5) * 0.6 + (random() - 0.5) * 0.75
        washes.push({
          ...cell,
          kind: Kind.Square,
          ink: pigment(light, w),
          ink2: pigment(clamp(light + 0.04), w + (random() - 0.5) * 0.5),
          density: 0.78 + 0.5 * random(),
          seed: four(random),
          extra: [0, 1, 0, 0],
          from: [random(), random()],
          delay: 900 * away * random() + 0.2 * Math.min(cy, 1200),
          lasts: 1100,
          grow: 0,
        })
      })
    }
    // the pencil net, ruled a little past
    if (random() < 0.75 && !narrow) washes.push(...ruled({ x: 2, y: y - 1, w: width - 4, h: 3 }, taken, random))
    y += rowH
  }
  if (!narrow)
    for (let x = edgeX; x < width; x += unit * (1.2 + random())) washes.push(...ruled({ x, y: 4, w: 3, h: height - 8 }, taken, random))
  return { washes, paper: PAPER }
}

/** A ruled line that lifts off where something is written. */
export function ruled(line: Rect, taken: Rect[], random: Random): Wash[] {
  const across = line.w > line.h
  const from = across ? line.x : line.y
  const to = from + (across ? line.w : line.h)
  const holes = taken
    .filter((box) => (across ? line.y > box.y - 3 && line.y < box.y + box.h + 3 : line.x > box.x - 3 && line.x < box.x + box.w + 3))
    .map((box) => (across ? [box.x, box.x + box.w] : [box.y, box.y + box.h]))
    .sort((a, b) => a[0] - b[0])
  const pieces: Wash[] = []
  let at = from
  for (const [a, b] of [...holes, [to, to]]) {
    if (a - at > 24) pieces.push(pencil(across ? { ...line, x: at, w: a - at } : { ...line, y: at, h: a - at }, random))
    at = Math.max(at, b)
  }
  return pieces
}

export function pencil(rect: Rect, random: Random): Wash {
  return { ...rect, kind: Kind.Pencil, ink: [0.4, 0.4, 0.4], ink2: [0.4, 0.4, 0.4], density: 0.8, seed: four(random), delay: 0, lasts: 900, grow: 0, still: true }
}

// ---------------------------------------------------------------------------------------------
// Painted name: bare paper, the name in glazes whose paint ran, and a wash for the line pointed at.

/** Dark enough to be read as ink, each letter a pigment of its own along one turn of the wheel. */
export function letterInk(i: number, count: number, turn: number): [RGB, RGB] {
  const at = (i / Math.max(1, count - 1)) * 1.0 + turn
  const w = 0.5 + 0.62 * Math.sin(at * 6.283)
  const light = 0.16 + 0.2 * (0.5 + 0.5 * Math.sin(i * 2.4 + turn * 9))
  return [pigment(light, w), pigment(light + 0.2, w + 0.35 * Math.cos(i * 1.7))]
}

function runsOf(letters: Letter[], blocked: Rect[], inks: [RGB, RGB][], random: Random, most: number): Wash[] {
  const runs: Wash[] = []
  const base = Math.max(...letters.map((letter) => letter.y))
  letters.forEach((letter, i) => {
    if (letter.y < base - 20) return // the top line would run through the one under it
    const low = Math.max(...letter.feet.map((foot) => foot.y))
    const soles = letter.feet.filter((foot) => foot.y > low - 8)
    const count = random() < 0.62 ? 1 + (random() < 0.4 ? 1 : 0) : 0
    for (let n = 0; n < count; n++) {
      const foot = soles[Math.floor((0.15 + 0.7 * random()) * soles.length)]
      if (!foot) continue
      const w = 4.5 + 8 * random() * random()
      let h = 26 + most * random() * random()
      for (const box of blocked)
        if (foot.x + w > box.x - 6 && foot.x - w < box.x + box.w + 6 && foot.y < box.y + box.h) h = Math.min(h, box.y - 12 - foot.y)
      if (h < 16) continue
      const [ink, ink2] = inks[i]
      runs.push({ x: foot.x - w / 2, y: foot.y - 4, w, h, kind: Kind.Run, ink, ink2, density: 0.62, seed: four(random), extra: [0, 0, 0, 0], delay: 1300 + i * 90 + 500 * random(), lasts: 3200, grow: 0, still: true })
    }
  })
  return runs
}

export const paintedName: Compose = ({ boxes: measure, shell, random, width, long }) => {
  const boxes = measure()
  const from = shell.getBoundingClientRect()
  const washes: Wash[] = []
  const cutter = new Cutter()

  for (const line of of(boxes, 'line')) {
    const own = seeded(hashOf(line.key))
    const w = toneOf(line.element.querySelector<HTMLElement>('[data-paint="swatch"]')?.dataset.key ?? line.key).warmth
    washes.push({
      x: line.x - 14,
      y: line.y + 3,
      w: line.w + 28,
      h: line.h - 6,
      kind: Kind.Square,
      ink: pigment(0.72 + 0.14 * own(), w),
      ink2: pigment(0.82, w + 0.5 * (own() - 0.5)),
      density: 0.7,
      seed: four(own),
      extra: [0, 0.5, 0, 0],
      grow: 0,
      flood: line.element,
    })
  }
  const swatches = of(boxes, 'swatch').filter((box) => box.w > 0)
  if (!long) for (const swatch of swatches) washes.push(swatchWash(swatch, random))

  const name = of(boxes, 'title')[0] ?? of(boxes, 'name')[0]
  const letters = name && lettersOf(name.element, from.left, from.top, cutter)
  if (name && letters) {
    const turn = name.name === 'name' ? random() : (hashOf(name.key) % 1000) / 1000
    const inks = letters.letters.map((_, i) => letterInk(i, letters.letters.length, turn))
    const big = parseFloat(getComputedStyle(name.element).fontSize)
    letters.letters.forEach((letter, i) => {
      washes.push({
        x: letter.x, y: letter.y, w: letter.w, h: letter.h,
        kind: Kind.Letter,
        ink: inks[i][0], ink2: inks[i][1],
        density: big > 90 ? 1.02 : 1.35,
        seed: four(random),
        extra: letter.uv,
        field: letters.field,
        index: i,
        from: [0.2 + 0.6 * random(), random()],
        delay: i * 95,
        lasts: 1900,
        grow: 0,
      })
    })
    if (name.name === 'name' && big > 90) washes.push(...runsOf(letters.letters, of(boxes, 'intro', 'heading', 'line', 'nav', 'staff'), inks, random, width > 900 ? (long ? 420 : 210) : 110))
    // drops that flew off the brush
    if (name.name === 'name')
      for (let i = 0; i < (width > 900 ? 18 : 8); i++) {
        const s = 4 + 22 * random() ** 3
        const x = name.x + name.w * random() * 1.02
        const y = name.y - 10 + (name.h + 60) * random()
        const spot = { x, y, w: s, h: s * (0.8 + 0.4 * random()) }
        if (of(boxes, 'intro', 'heading', 'nav', 'line', 'staff').some((box) => meets(grown(spot, 6), box))) continue
        if (letters.letters.some((letter) => letter.feet.length && meets(spot, { x: letter.feet[0].x, y: name.y + (letter.y > name.y + 60 ? name.h / 2 : 0), w: letter.feet[letter.feet.length - 1].x - letter.feet[0].x, h: name.h / 2 }))) continue
        const [ink, ink2] = inks[Math.floor(random() * inks.length)]
        washes.push({ ...spot, kind: Kind.Puddle, ink, ink2, density: 0.8, seed: four(random), extra: [2, 0.9, 0, 0], delay: 700 + 900 * random(), lasts: 500, grow: 0, still: true })
      }
  }
  // One run goes on: down the list, and it pools where a piece is.
  if (!long && name?.name === 'name' && letters && swatches.length) {
    const x = swatches[0].x + swatches[0].w / 2
    const feet = letters.letters.flatMap((letter) => letter.feet).filter((foot) => Math.abs(foot.x - x) < swatches[0].w * 1.2)
    const low = Math.max(...feet.map((foot) => foot.y))
    const sole = feet.filter((foot) => foot.y > low - 5).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0]
    let at = sole ? { x: sole.x, y: sole.y - 6, inks: noteInk(swatches[0].key) } : undefined
    for (const swatch of swatches) {
      const own = seeded(hashOf(swatch.key) + 1)
      const inks = noteInk(swatch.key)
      if (at) {
        const w = 4 + 2.4 * own()
        washes.push({ x: at.x - w / 2, y: at.y, w, h: swatch.y + swatch.h * 0.5 - at.y, kind: Kind.Run, ink: at.inks[0], ink2: inks[0], density: 0.72, seed: four(own), extra: [0, 0, 0, 0], delay: 900, lasts: 1800, grow: 0, still: true })
      }
      at = { x: swatch.x + swatch.w * (0.36 + 0.28 * own()), y: swatch.y + swatch.h - 5, inks }
    }
  }
  washes.push(...staffWashes(boxes, random))
  for (const rule of of(boxes, 'rule')) washes.push(pencil({ x: rule.x, y: rule.y - 1, w: rule.w, h: 3 }, random))
  return { washes, paper: PAPER, mask: cutter.sheet() }
}

// ---------------------------------------------------------------------------------------------
// Estuary: sandbanks seen from the air, and a creek of bare paper that the writing runs down.

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

export const estuary: Compose = ({ width, height, boxes: measure, shell, random }) => {
  still(shell)
  let boxes = measure()
  const sheet = of(boxes, 'sheet')[0]
  const tone = sheet && toneOf(sheet.key)
  let course: Course
  if (width < NARROW) course = courseRound(writtenIn(boxes, shell), width, height)
  else {
    const stream = of(boxes, 'stream')[0]
    const half = (stream ? stream.w / 2 : 360) + 46 + 14 * tide()
    const winds = clamp((width / 2 - half) * 0.42, 10, sheet ? 44 : 96)
    const mouth = Math.max(0, width * 0.36 - half)
    const middle = (y: number) => width / 2 + winds * winding(y)
    wander(shell, middle, width)
    boxes = measure()
    course = courseOf(height, (y) => [middle(y), half + mouth * Math.exp(-(((y - 300) / 250) ** 2))])
  }
  return { washes: banks({ width, top: 0, foot: height + 60, course, random, tone }), paper: PAPER, course }
}

// ---------------------------------------------------------------------------------------------
// One long page: the paint of the name runs down to the score, and under the score the writing runs
// down the estuary to the sea.

export const longPage: Compose = (page) => {
  const { width, height, shell, boxes: measure, random } = page
  const narrow = width < NARROW
  still(shell)
  const stream = of(measure(), 'stream')[0]
  if (!stream) return paintedName(page)
  const top = stream.y
  const foot = stream.y + stream.h
  let course: Course
  if (narrow) course = courseRound(writtenIn(measure(), shell), width, height)
  else {
    const half = 356 + 14 * tide()
    const winds = clamp((width / 2 - half) * 0.42, 10, 96)
    const middle = (y: number) => width / 2 + winds * winding(y) * smooth(top - 100, top + 300, y) * (1 - smooth(foot - 500, foot, y))
    wander(shell, middle, width)
    const open = width * 0.62 - half
    course = courseOf(height, (y) => [middle(y), half + open * (1 - smooth(top - 160, top + 420, y)) + open * smooth(foot - 520, foot + 60, y)])
  }
  const name = paintedName({ ...page, long: true })
  return {
    washes: [...banks({ width, top: top - 40, foot: foot - 40, course, random }), ...name.washes],
    paper: PAPER,
    course,
    mask: name.mask,
  }
}

// ---------------------------------------------------------------------------------------------
// Score: the years run from left to right and what a thought is about from low to high. A thought
// is a stroke of strong paint; what is silent is pale squares.

export const score: Compose = ({ boxes: measure, random }) => {
  const boxes = measure()
  const swatches = of(boxes, 'swatch').filter((box) => box.w > 0).map((swatch) => swatchWash(swatch, random))
  const cutter = new Cutter()
  const pictures = of(boxes, 'picture').flatMap((box) => plate(box, box.key, cutter, seeded(hashOf(box.key)), true))
  return { washes: [...swatches, ...sheetWashes(boxes, random), ...staffWashes(boxes, random), ...pictures], paper: PAPER, mask: cutter.sheet() }
}

function staffWashes(boxes: PaintBox[], random: Random): Wash[] {
  const washes: Wash[] = []
  const staff = of(boxes, 'staff')[0]
  const notes = of(boxes, 'note')
  const turn = random() * 6
  if (!staff) return []

  const lanes = Math.max(1, Number(staff.element.dataset.lanes ?? 8))
  const lane = staff.h / lanes
  const taken = notes.map((note) => grown(note, 3))
  for (let j = 0; j < lanes; j++) {
    let x = staff.x + (random() - 0.5) * 16
    const bottom = staff.y + (j + 1) * lane
    while (x < staff.x + staff.w - 10) {
      let w = lane * (0.28 + 0.95 * random())
      if (random() < 0.14) w *= 1.8
      w = Math.min(w, staff.x + staff.w - x)
      if (staff.x + staff.w - x - w < 16) w = staff.x + staff.w - x
      const whole = { x: x + 3, y: bottom - lane + 3, w: w - 6, h: lane - 6 }
      const halves = random() > 0.82 ? [{ ...whole, h: whole.h / 2 - 3 }, { ...whole, y: whole.y + whole.h / 2 + 3, h: whole.h / 2 - 3 }] : [whole]
      halves.forEach((part, odd) => {
        const cell = beside(part, taken, 10)
        if (!cell) return
        const cx = (cell.x + cell.w / 2 - staff.x) / staff.w
        const cy = (j + 0.5) / lanes
        const away = Math.hypot((cx - 0.56) * 1.9, (cy - 0.46) * 1.5)
        const light = clamp(1.16 - 0.78 * away + (random() - 0.5) * 0.24)
        const w2 = 0.46 + 0.34 * Math.sin(cx * 3.6 - cy * 2.4 + turn) + (odd - 0.5) * 0.6 + (random() - 0.5) * 0.6
        washes.push({ ...cell, kind: Kind.Square, ink: pigment(light, w2), ink2: pigment(clamp(light + 0.05), w2 + 0.4 * (random() - 0.5)), density: 0.5 + 0.4 * random(), seed: four(random), extra: [0, 1, 0, 0], from: [0, random()], delay: 1500 * cx + 250 * random(), lasts: 900, grow: 0 })
      })
      x += w
    }
    washes.push(pencil({ x: staff.x - 10, y: bottom - 1.5, w: staff.w + 20, h: 3 }, random))
  }
  for (const note of notes) {
    const [ink, ink2] = noteInk(note.key)
    washes.push({ ...note, kind: Kind.Square, ink, ink2, density: 1.12, seed: four(seeded(hashOf(note.key))), extra: [0, 1, 0, 0], from: [0, 0.5], delay: 300 + 1500 * ((note.x - staff.x) / staff.w), lasts: 1200, grow: 0, stands: note.element })
  }
  for (const tick of of(boxes, 'tick')) washes.push(pencil({ x: tick.x - 1, y: staff.y - 14, w: 3, h: staff.h + 28 }, random))
  // the line the voices are mirrored in
  for (const by of [-2, 0.5]) washes.push(pencil({ x: staff.x - 22, y: staff.y + staff.h / 2 + by, w: staff.w + 44, h: 3 }, random))
  return washes
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

function swatchWash(swatch: PaintBox, random: Random): Wash {
  const own = seeded(hashOf(swatch.key))
  const [ink, ink2] = noteInk(swatch.key)
  return { ...swatch, kind: Kind.Square, ink, ink2, density: 1.1, seed: four(own), extra: [0, 1, 0, 0], from: [own(), own()], delay: 400 + 500 * random(), lasts: 1100, grow: 0 }
}

/** Squares made of what is written: a word to a square beside an entry, a sentence to a square over an article. */
function sheetWashes(boxes: PaintBox[], random: Random): Wash[] {
  return of(boxes, 'phrase').flatMap((band) => (band.element.dataset.of === 'article' ? sentences(band, random) : words(band, random)))
}

function square(rect: Rect, light: number, warmth: number, own: Random, delay: number): Wash {
  return { ...rect, kind: Kind.Square, ink: pigment(light, warmth), ink2: pigment(clamp(light + 0.1), warmth + 0.4 * (own() - 0.5)), density: 0.9 + 0.3 * own(), seed: four(own), extra: [0, 1, 0, 0], from: [0, own()], delay, lasts: 900, grow: 0 }
}

/** The words of a title in strong paint and those under it in pale, each as wide as it is long. */
function words(band: PaintBox, random: Random): Wash[] {
  const own = seeded(hashOf(band.key))
  const tone = toneOf(band.key)
  const of = (text = '') => text.split(/\s+/).filter(Boolean)
  const strong = of(band.element.dataset.strong)
  const all = [...strong.map((word) => ({ word, strong: true })), ...of(band.element.dataset.pale).map((word) => ({ word, strong: false }))]
  const letter = Math.max(4.4, Math.min(8.5, (band.w * 0.72) / strong.reduce((sum, word) => sum + word.length + 0.8, 0)))
  const washes: Wash[] = []
  let x = band.x
  for (const one of all) {
    const w = Math.max(7, one.word.length * letter)
    if (x + w > band.x + band.w + 1) break
    const warmth = one.strong ? tone.warmth + 0.5 * (own() - 0.5) : 0.4 + 0.5 * own()
    const light = one.strong ? clamp(tone.light * 0.6 + 0.3 * own() ** 2) : 0.72 + 0.24 * own()
    washes.push(square({ x, y: band.y, w, h: band.h }, light, warmth, own, 700 * ((x - band.x) / band.w) + 150 * random()))
    x += w + 4.5
  }
  return washes
}

/** Every sentence of an article, in its order and as wide as it is long: deep for a heading, red for a question. */
function sentences(band: PaintBox, random: Random): Wash[] {
  const own = seeded(hashOf(band.key))
  const tone = toneOf(band.key)
  const found: { length: number; kind: 'heading' | 'question' | 'other'; block: number; element: Element }[] = []
  const prose = band.element.closest('article')?.querySelector('.wc-prose')
  ;[...(prose?.children ?? [])].forEach((element, block) => {
    const text = element.textContent?.trim() ?? ''
    if (/^H\d$/.test(element.tagName)) found.push({ length: text.length, kind: 'heading', block, element })
    else
      for (const sentence of text.match(/[^.!?\n]+[.!?]*/g) ?? [])
        if (sentence.trim().length > 2) found.push({ length: sentence.trim().length, kind: sentence.trim().endsWith('?') ? 'question' : 'other', block, element })
  })
  if (!found.length) return []
  const gap = 5
  const rows = clamp(Math.round(band.h / 25), 1, 9)
  const rowH = band.h / rows
  const total = found.reduce((sum, one) => sum + one.length, 0)
  // as many sentences to a row as make it full, and then the row is drawn out to its edge
  const perRow = total / rows
  const lines: (typeof found)[] = [[]]
  let sum = 0
  for (const one of found) {
    if (sum + one.length / 2 > perRow * lines.length && lines.length < rows) lines.push([])
    lines[lines.length - 1].push(one)
    sum += one.length
  }
  const washes: Wash[] = []
  lines.forEach((line, row) => {
    const letters = line.reduce((all, one) => all + one.length, 0)
    const room = band.w - gap * (line.length - 1)
    let x = band.x
    for (const one of line) {
      const w = (one.length / letters) * room
      const pale = 0.5 + 0.5 * Math.sin(one.block * 1.9 + tone.warmth * 6)
      const [light, warmth] =
        one.kind === 'heading' ? [0.02 + 0.14 * own(), 0.1 + 0.2 * own()] : one.kind === 'question' ? [0.24 + 0.1 * own(), 0.95] : [clamp(0.5 + 0.42 * pale + (own() - 0.5) * 0.24), tone.warmth + 0.55 * Math.sin(one.block * 2.4) + 0.2 * (own() - 0.5)]
      if (w > 3) washes.push({ ...square({ x, y: band.y + row * rowH, w, h: rowH - gap }, light, warmth, own, 160 * row + 500 * ((x - band.x) / band.w) + 100 * random()), leads: one.element })
      x += w + gap
    }
  })
  return washes
}

// ---------------------------------------------------------------------------------------------
// Mosaic: the net again, and the name is in it. A square inside a letter is deep, one outside is light.

export const mosaic: Compose = ({ width, boxes: measure, shell, random }) => {
  const boxes = measure()
  const washes: Wash[] = [...sheetWashes(boxes, random)]
  const name = of(boxes, 'name')[0]
  const letters = name && linesOf(name.element, shell, width < 700 ? 7 : 9)
  if (!name || !letters) return { washes, paper: PAPER }
  if (width < 700 && name.element.closest('[data-small]')) return { washes, paper: PAPER } // too small for squares
  const turn = random() * 6
  const top = 10
  const small = width < 700
  const edge = small ? 6 : 12
  const bottom = name.y + name.h + letters.row * (width < 700 ? 2.4 : 2.1)
  for (let at = letters.top % letters.row - letters.row; at < bottom; at += letters.row) {
    const y = at + (random() - 0.5) * 1.5
    if (y < top - letters.row * 0.4) continue
    // the stretches of this row that are in a letter, and those between
    const stops = [edge, ...letters.stretches(y, letters.row).flat().filter((x) => x > edge && x < width - edge), width - edge]
    for (let i = 0; i + 1 < stops.length; i++) {
      const inside = i % 2 === 1
      let x = stops[i]
      while (x < stops[i + 1] - 3) {
        let w = letters.row * (inside ? (small ? 2.6 + 1.2 * random() : 0.9 + 1.5 * random()) : (small ? 1.4 : 0.55) + (small ? 3 : 1.9) * random())
        if (stops[i + 1] - x - w < letters.row * 0.5) w = stops[i + 1] - x
        const cx = (x + w / 2) / width
        const cy = (y - top) / (bottom - top)
        const warmth = 0.5 + 0.46 * Math.sin(cx * 5.2 - cy * 2.6 + turn) + (random() - 0.5) * 0.7
        const light = inside ? clamp(0.02 + 0.36 * random() * random() + 0.1 * Math.sin(cx * 9 + turn)) : clamp(0.97 - 0.34 * random() ** 2.4 - 0.1 * Math.abs(cx - 0.5))
        const gap = small ? 0.9 : 1.6
        washes.push({
          x: x + gap, y: y + gap, w: w - gap * 2, h: letters.row - gap * 2,
          kind: Kind.Square,
          ink: pigment(light, warmth),
          ink2: pigment(clamp(light + 0.08), warmth + 0.5 * (random() - 0.5)),
          density: inside ? 1.0 + 0.35 * random() : 0.42 + 0.4 * random(),
          seed: four(random),
          extra: [0, w > 30 ? 1 : 0, 0, 0],
          from: [0.5, 0.5],
          delay: inside ? 900 + 900 * random() : 700 * random() + 300 * cx,
          lasts: 900,
          grow: 0,
        })
        x += w
      }
    }
  }
  return { washes, paper: PAPER }
}

/** The name as rows: for each, the stretches from x to x that lie in a letter. */
function linesOf(element: HTMLElement, shell: HTMLElement, rows: number) {
  const style = getComputedStyle(element)
  const size = parseFloat(style.fontSize)
  const from = shell.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  const box = element.getBoundingClientRect()
  const left = Math.floor(box.left - from.left - 20)
  const start = Math.floor(box.top - from.top - size * 0.3)
  canvas.width = Math.ceil(shell.clientWidth - left)
  canvas.height = Math.ceil(box.height + size * 0.6)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return undefined
  context.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`
  const ascent = context.measureText('Hg').fontBoundingBoxAscent
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let first = Infinity
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    for (let i = 0; i < text.length; i++) {
      if (!text[i].trim()) continue
      const range = document.createRange()
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const at = range.getBoundingClientRect()
      const base = at.top - from.top + ascent
      first = Math.min(first, base - size * 0.727)
      context.fillText(style.textTransform === 'uppercase' ? text[i].toUpperCase() : text[i], at.left - from.left - left, base - start)
    }
  }
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  // whole rows to a capital, so that a letter's bars fall on them
  const row = (size * 0.727) / rows
  const stretches = (y: number, h: number): [number, number][] => {
    const y0 = Math.round(y - start)
    const y1 = Math.round(y + h - start)
    if (y1 <= 0 || y0 >= canvas.height) return []
    const found: [number, number][] = []
    let open = -1
    for (let x = 0; x <= canvas.width; x++) {
      let sum = 0
      let n = 0
      if (x < canvas.width)
        for (let yy = Math.max(0, y0); yy < Math.min(canvas.height, y1); yy += 2) {
          sum += pixels[(yy * canvas.width + x) * 4 + 3]
          n++
        }
      const on = n > 0 && sum / n > 120
      if (on && open < 0) open = x
      if (!on && open >= 0) {
        if (x - open > 4) found.push([open + left, x + left])
        open = -1
      }
    }
    return found
  }
  return { row, top: first, stretches }
}
