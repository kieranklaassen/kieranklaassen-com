import {
  banks,
  courseOf,
  courseRound,
  grown,
  letterInk,
  meets,
  NARROW,
  noteInk,
  of,
  PAPER,
  pencil,
  still,
  tide,
  toneOf,
  wander,
  winding,
  writtenIn,
  type Compose,
} from './compose_shared'
import { staffWashes, swatchWash } from './compose_staff'
import { lettersOf, type Letter } from './letters'
import { Cutter } from './mask'
import { Kind, type Course, type RGB, type Rect, type Wash } from './painter'
import { clamp, four, hashOf, pigment, seeded, smooth, type Random } from './pigments'

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

// Painted name: bare paper, the name in glazes whose paint ran, and a wash for the line pointed at.
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
