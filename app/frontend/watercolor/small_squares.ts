import { grown, meets, of, PAPER, pencil, type Compose } from './compose_shared'
import { beside } from './compose_staff'
import { Kind, type RGB, type Rect, type Wash } from './painter'
import { clamp, four, hashOf, pigment, seeded, smooth, type Random } from './pigments'

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
