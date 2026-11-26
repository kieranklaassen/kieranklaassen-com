import { lettersOf, type Letter, type Mask } from './letters'
import { Kind, type Creek, type RGB, type Rect, type Wash } from './painter'
import { clamp, four, hashOf, mixInk, pigment, seeded, smooth, type Random } from './pigments'

export interface PaintBox extends Rect {
  name: string
  key: string
  element: HTMLElement
}

export interface Composition {
  washes: Wash[]
  paper: RGB
  creek?: Creek
  mask?: Mask
}

export interface Page {
  width: number
  height: number
  shell: HTMLElement
  /** The boxes the page asks paint for, measured now. */
  boxes: () => PaintBox[]
  random: Random
}

export type Compose = (page: Page) => Composition

const PAPER: RGB = [0.972, 0.953, 0.912]

const grown = (box: Rect, by: number): Rect => ({ x: box.x - by, y: box.y - by, w: box.w + by * 2, h: box.h + by * 2 })
const meets = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** What is left of `cell` beside every rectangle in `taken`: the largest piece each time. */
function beside(cell: Rect, taken: Rect[], least: number): Rect | undefined {
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

const of = (boxes: PaintBox[], ...names: string[]) => boxes.filter((box) => names.includes(box.name))

// ---------------------------------------------------------------------------------------------
// Wet blocks: the 134 pixel grid of the site as it was, one pigment a visit, laid wet into wet.

const PIGMENTS: [RGB, RGB][] = [
  [[0.2, 0.32, 0.58], [0.6, 0.46, 0.6]], // indigo that goes to mauve
  [[0.14, 0.44, 0.5], [0.42, 0.44, 0.66]], // a green blue to violet
  [[0.46, 0.34, 0.6], [0.82, 0.48, 0.52]], // violet to rose
  [[0.26, 0.47, 0.4], [0.72, 0.64, 0.34]], // a deep green to ochre
  [[0.76, 0.34, 0.26], [0.86, 0.6, 0.36]], // a burnt red to amber
  [[0.16, 0.38, 0.54], [0.78, 0.6, 0.42]], // sea to sand
]
const BLOCK = 134

export const wetBlocks: Compose = ({ width, height, boxes, random }) => {
  const [ink, ink2] = PIGMENTS[Math.floor(random() * PIGMENTS.length)]
  const quiet = of(boxes(), 'name', 'intro', 'heading')
  const washes: Wash[] = []
  for (let x = 0; x < width; x += BLOCK) {
    for (let y = 0; y < height; y += BLOCK) {
      const cell = { x, y, w: BLOCK, h: BLOCK }
      const r = random()
      const lean = random()
      let density = r < 0.16 ? 0.02 : 0.08 + 1.15 * r * r
      if (quiet.some((box) => meets(cell, box))) density = 0.05 + 0.32 * r
      washes.push({
        ...cell,
        kind: Kind.Wet,
        ink: mixInk(ink, ink2, 0.7 * lean),
        ink2: mixInk(ink, ink2, clamp(0.7 * lean + 0.34)),
        density,
        seed: four(random),
        extra: [0, r > 0.8 ? 1.2 : 0, 0, 0],
        from: [random(), random()],
        delay: 0.35 * y + 0.12 * x + 500 * random(),
        lasts: 1800,
        grow: 0,
      })
    }
  }
  return { washes, paper: [0.965, 0.955, 0.935] }
}

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
function ruled(line: Rect, taken: Rect[], random: Random): Wash[] {
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

function pencil(rect: Rect, random: Random): Wash {
  return { ...rect, kind: Kind.Pencil, ink: [0.4, 0.4, 0.4], ink2: [0.4, 0.4, 0.4], density: 0.8, seed: four(random), delay: 0, lasts: 900, grow: 0, still: true }
}

// ---------------------------------------------------------------------------------------------
// Painted name: bare paper, the name in glazes whose paint ran, and a wash for the line pointed at.

/** Dark enough to be read as ink, each letter a pigment of its own along one turn of the wheel. */
function letterInk(i: number, count: number, turn: number): [RGB, RGB] {
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

export const paintedName: Compose = ({ boxes: measure, shell, random, width }) => {
  const boxes = measure()
  const from = shell.getBoundingClientRect()
  const washes: Wash[] = []
  let mask: Mask | undefined

  for (const line of of(boxes, 'line')) {
    const own = seeded(hashOf(line.key))
    const w = own()
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
  for (const swatch of of(boxes, 'swatch')) washes.push(swatchWash(swatch, random))

  const name = of(boxes, 'title')[0] ?? of(boxes, 'name')[0]
  const letters = name && lettersOf(name.element, from.left, from.top)
  if (name && letters) {
    mask = letters.mask
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
        from: [0.2 + 0.6 * random(), random()],
        delay: i * 95,
        lasts: 1900,
        grow: 0,
      })
    })
    if (name.name === 'name' && big > 90) washes.push(...runsOf(letters.letters, of(boxes, 'intro', 'heading', 'line', 'nav'), inks, random, width > 900 ? 210 : 90))
    // drops that flew off the brush
    if (name.name === 'name')
      for (let i = 0; i < (width > 900 ? 18 : 8); i++) {
        const s = 4 + 22 * random() ** 3
        const x = name.x + name.w * random() * 1.02
        const y = name.y - 10 + (name.h + 60) * random()
        const spot = { x, y, w: s, h: s * (0.8 + 0.4 * random()) }
        if (of(boxes, 'intro', 'heading', 'nav', 'line').some((box) => meets(grown(spot, 6), box))) continue
        if (letters.letters.some((letter) => letter.feet.length && meets(spot, { x: letter.feet[0].x, y: name.y + (letter.y > name.y + 60 ? name.h / 2 : 0), w: letter.feet[letter.feet.length - 1].x - letter.feet[0].x, h: name.h / 2 }))) continue
        const [ink, ink2] = inks[Math.floor(random() * inks.length)]
        washes.push({ ...spot, kind: Kind.Puddle, ink, ink2, density: 0.8, seed: four(random), extra: [2, 0.9, 0, 0], delay: 700 + 900 * random(), lasts: 500, grow: 0, still: true })
      }
  }
  for (const rule of of(boxes, 'rule')) washes.push(pencil({ x: rule.x, y: rule.y - 1, w: rule.w, h: 3 }, random))
  return { washes, paper: [0.978, 0.966, 0.938], mask }
}

// ---------------------------------------------------------------------------------------------
// Estuary: sandbanks seen from the air, and a creek of bare paper that the writing runs down.

export const creekAt = (creek: Creek, y: number) =>
  creek.middle + creek.wind * (0.62 * Math.sin(y / 310 + 0.6) + 0.38 * Math.sin(y / 173 + 2))

export const estuary: Compose = ({ width, height, boxes: measure, shell, random }) => {
  for (const element of shell.querySelectorAll<HTMLElement>('[data-wander]')) element.style.translate = ''
  const stream = of(measure(), 'stream')[0]
  const narrow = width < 900
  const half = narrow ? 9 : (stream ? stream.w / 2 : 360) + 46
  const creek: Creek = {
    middle: width / 2,
    wind: narrow ? width * 0.24 : clamp((width / 2 - half) * 0.42, 10, 96),
    half,
    mouth: narrow ? 0 : Math.max(0, width * 0.36 - half),
    mouthAt: narrow ? 120 : 300,
    mouthReach: 250,
  }
  const from = shell.getBoundingClientRect()
  for (const element of shell.querySelectorAll<HTMLElement>('[data-wander]')) {
    const box = element.getBoundingClientRect()
    if (!narrow) element.style.translate = `${(creekAt(creek, box.top - from.top + box.height / 2) - creek.middle).toFixed(1)}px 0`
  }
  const boxes = measure()
  const washes: Wash[] = []
  const turn = random() * 6
  const taken = narrow ? of(boxes, 'name', 'intro', 'nav', 'heading', 'card', 'repo', 'sheet').map((box) => ({ ...grown(box, 14), x: 0, w: width })) : []
  // how far down a bank lies from where its row is ruled
  const sunk = (x: number, y: number, bank: number) =>
    900 * (0.034 * Math.sin((x / 900) * 2.3 + 0.9) + 0.02 * Math.sin((x / 900) * 4.6 + (2.4 * y) / 900 + 2)) + 62 * Math.exp(-((bank / 190) ** 2))

  let y = -90
  let row = 0
  while (y < height + 60) {
    const rowH = (narrow ? 30 : 48) + (narrow ? 16 : 30) * random()
    const rowSeed = random()
    let x = -40 - 80 * random()
    while (x < width + 20) {
      const w = (narrow ? 60 : 90) + (narrow ? 90 : 200) * random()
      const cx = x + w / 2
      const cy = y + rowH / 2
      const bank = Math.abs(cx - creekAt(creek, cy)) - half
      const light = clamp(0.98 - 0.92 * smooth(-40, narrow ? 190 : Math.max(150, width / 2 - half), bank) + (random() - 0.5) * 0.36)
      const warmth = 0.5 + 0.36 * Math.sin((cx / 900) * 2.1 - (cy / 900) * 2.2 + turn) + (random() - 0.5) * 0.8
      const wash: Wash = {
        x, y, w: w - 5, h: rowH,
        kind: Kind.Bank,
        ink: pigment(light, warmth),
        ink2: pigment(clamp(light + 0.08), warmth + 0.4 * (random() - 0.5)),
        density: 0.8 + 0.42 * random(),
        seed: [rowSeed, random(), random(), random()],
        extra: [0, 1, 0, 0],
        from: [cx < creek.middle ? 0 : 1, 0.5],
        delay: 0.45 * Math.max(0, cy) + 350 * random(),
        lasts: 1500,
        grow: 0,
      }
      const lies = y + sunk(cx, cy + 40, bank)
      if (bank + w / 2 > -70 && !taken.some((box) => meets({ x, y: lies - 12, w, h: rowH + 24 }, box))) washes.push(wash)
      x += w
    }
    y += rowH * 0.98
    row++
  }
  return { washes, paper: PAPER, creek }
}

// ---------------------------------------------------------------------------------------------
// Score: the years run from left to right and what a thought is about from low to high. A thought
// is a stroke of strong paint; what is silent is pale squares.

export const score: Compose = ({ boxes: measure, random }) => {
  const boxes = measure()
  const washes: Wash[] = []
  const staff = of(boxes, 'staff')[0]
  const notes = of(boxes, 'note')
  const turn = random() * 6
  for (const swatch of of(boxes, 'swatch')) washes.push(swatchWash(swatch, random))
  if (!staff) return { washes: [...washes, ...sheetWashes(boxes, random)], paper: PAPER }

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
    washes.push({ ...note, kind: Kind.Square, ink, ink2, density: 1.12, seed: four(seeded(hashOf(note.key))), extra: [0, 1, 0, 0], from: [0, 0.5], delay: 300 + 1500 * ((note.x - staff.x) / staff.w), lasts: 1200, grow: 0 })
  }
  for (const tick of of(boxes, 'tick')) washes.push(pencil({ x: tick.x - 1, y: staff.y - 14, w: 3, h: staff.h + 28 }, random))
  return { washes, paper: PAPER }
}

/** The strong pigment of one thought, the same in the score and beside its title. */
function noteInk(key: string): [RGB, RGB] {
  const own = seeded(hashOf(key))
  const w = own() < 0.5 ? own() * 0.3 : 0.7 + own() * 0.3
  const light = 0.04 + 0.42 * own()
  return [pigment(light, w), pigment(light + 0.16, w + 0.5 * (own() - 0.5))]
}

function swatchWash(swatch: PaintBox, random: Random): Wash {
  const own = seeded(hashOf(swatch.key))
  const [ink, ink2] = noteInk(swatch.key)
  return { ...swatch, kind: Kind.Square, ink, ink2, density: 1.1, seed: four(own), extra: [0, 1, 0, 0], from: [own(), own()], delay: 400 + 500 * random(), lasts: 1100, grow: 0 }
}

/** An article's own short phrase of squares over its title. */
function sheetWashes(boxes: PaintBox[], random: Random): Wash[] {
  const washes: Wash[] = []
  for (const band of of(boxes, 'phrase')) {
    const own = seeded(hashOf(band.key))
    let x = band.x
    while (x < band.x + band.w - 8) {
      const w = Math.min(band.h * (0.35 + 1.1 * own()), band.x + band.w - x)
      const away = Math.abs((x - band.x) / band.w - 0.5 * own()) * 2
      const light = clamp(0.1 + 0.85 * away + (own() - 0.5) * 0.3)
      const warmth = own()
      const whole = { x: x + 2.5, y: band.y, w: w - 5, h: band.h }
      const parts = own() > 0.75 ? [{ ...whole, h: band.h / 2 - 2.5 }, { ...whole, y: band.y + band.h / 2 + 2.5, h: band.h / 2 - 2.5 }] : [whole]
      for (const part of parts)
        if (part.w > 6)
          washes.push({ ...part, kind: Kind.Square, ink: pigment(light, warmth), ink2: pigment(clamp(light + 0.1), warmth + 0.4 * (own() - 0.5)), density: 0.9 + 0.3 * own(), seed: four(own), extra: [0, 1, 0, 0], from: [0, own()], delay: 700 * ((x - band.x) / band.w) + 150 * random(), lasts: 900, grow: 0 })
      x += w
    }
  }
  return washes
}


// ---------------------------------------------------------------------------------------------
// Mosaic: the net again, and the name is in it. A square inside a letter is deep, one outside is light.

export const mosaic: Compose = ({ width, boxes: measure, shell, random }) => {
  const boxes = measure()
  const washes: Wash[] = [...sheetWashes(boxes, random)]
  const name = of(boxes, 'name')[0]
  const letters = name && linesOf(name.element, shell)
  if (!name || !letters) return { washes, paper: PAPER }
  if (width < 700 && name.element.closest('[data-small]')) return { washes, paper: PAPER } // too small for squares
  const turn = random() * 6
  const top = 10
  const edge = width < 700 ? 6 : 12
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
        let w = letters.row * (inside ? 0.9 + 1.5 * random() : 0.55 + 1.9 * random())
        if (stops[i + 1] - x - w < letters.row * 0.5) w = stops[i + 1] - x
        const cx = (x + w / 2) / width
        const cy = (y - top) / (bottom - top)
        const warmth = 0.5 + 0.46 * Math.sin(cx * 5.2 - cy * 2.6 + turn) + (random() - 0.5) * 0.7
        const light = inside ? clamp(0.02 + 0.36 * random() * random() + 0.1 * Math.sin(cx * 9 + turn)) : clamp(0.97 - 0.34 * random() ** 2.4 - 0.1 * Math.abs(cx - 0.5))
        const gap = 1.6
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
function linesOf(element: HTMLElement, shell: HTMLElement) {
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
  const row = (size * 0.727) / 9
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
