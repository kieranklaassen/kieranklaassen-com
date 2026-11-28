import type { Picture, Pigment, Shape } from '../art/pictures_shared'
import type { Cutter } from './mask'
import { Kind, type RGB, type Rect, type Wash } from './painter'
import { clamp, four, pigment, type Random } from './pigments'

interface Sheet {
  /** How many units of the drawing go across and down it. */
  across: number
  down: number
}

export const WHOLE: Sheet = { across: 160, down: 100 }
export const DETAIL: Sheet = { across: 40, down: 40 }

// How far past its sheet a drawing may reach.
const PAST = 20
const bounds = new Map<string, Rect | undefined>()

/** The box a shape takes on its sheet, found by drawing it small. */
function boundsOf(shape: Shape, sheet: Sheet): Rect | undefined {
  const id = `${sheet.across}:${shape.brush ?? ''}:${shape.d}`
  if (bounds.has(id)) return bounds.get(id)
  const k = sheet.across > 100 ? 1 : 3
  const w = (sheet.across + PAST * 2) * k
  const h = (sheet.down + PAST * 2) * k
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return undefined
  context.setTransform(k, 0, 0, k, PAST * k, PAST * k)
  drawn(context, shape)
  const pixels = context.getImageData(0, 0, w, h).data
  let left = w
  let right = -1
  let top = h
  let foot = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (pixels[(y * w + x) * 4 + 3] > 8) {
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        foot = y
      }
  const box = right < 0 ? undefined : { x: left / k - PAST, y: top / k - PAST, w: (right - left + 1) / k, h: (foot - top + 1) / k }
  bounds.set(id, box)
  return box
}

function drawn(context: CanvasRenderingContext2D, shape: Shape) {
  const path = new Path2D(shape.d)
  if (shape.brush) {
    context.lineWidth = shape.brush
    context.lineCap = context.lineJoin = 'round'
    context.stroke(path)
  } else context.fill(path, 'evenodd')
}

const inkOf = ([light, warmth]: Pigment): RGB => pigment(clamp(light), warmth)

/** Whether a drawing runs off its sheet at the right, as a sea does. */
export const runsOff = (shapes: Shape[], sheet = WHOLE) => shapes.some((shape) => {
  const box = boundsOf(shape, sheet)
  return box && box.x + box.w >= sheet.across - 1
})

/** Takes off the left end of what a drawing cuts straight: a brush lifts where it lifts. */
function lifted(context: CanvasRenderingContext2D, box: Rect, random: Random) {
  const inset = 1 + 11 * random()
  const lean = (random() - 0.5) * 0.5
  const turn = random() * 6
  context.globalCompositeOperation = 'destination-out'
  context.beginPath()
  context.moveTo(-PAST, box.y - PAST)
  for (let i = 0; i <= 24; i++) {
    const y = box.y - 2 + ((box.h + 4) * i) / 24
    context.lineTo(Math.max(0, inset + lean * (y - box.y - box.h / 2) + 0.9 * Math.sin(y * 0.55 + turn) + 0.4 * Math.sin(y * 1.7 + turn * 2)), y)
  }
  context.lineTo(-PAST, box.y + box.h + PAST)
  context.fill()
  context.globalCompositeOperation = 'source-over'
}

/** Lays the shapes of a drawing at `x`, `y`, every unit of it `k` pixels long. */
export function laid(shapes: Shape[], sheet: Sheet, x: number, y: number, k: number, cutter: Cutter, random: Random, delay = 0, lifts = false): Wash[] {
  return shapes.flatMap((shape, i) => {
    const box = boundsOf(shape, sheet)
    if (!box) return []
    const pad = 8
    const w = box.w * k + pad * 2
    const h = box.h * k + pad * 2
    const scale = Math.min(1, 300 / Math.max(w, h), Math.max(0.5, 110 / Math.max(w, h)))
    const field = clamp(Math.min(box.w, box.h) * k * 0.3, 3, 15)
    const cut = cutter.cut(w, h, scale, field, (context) => {
      context.translate(pad - box.x * k, pad - box.y * k)
      context.scale(k, k)
      drawn(context, shape)
      if (lifts && !shape.brush && box.x < 1) lifted(context, box, random)
    })
    return {
      x: x + box.x * k - pad,
      y: y + box.y * k - pad,
      w: cut.w / scale,
      h: cut.h / scale,
      kind: Kind.Letter,
      ink: inkOf(shape.ink),
      ink2: inkOf(shape.to ?? shape.ink),
      density: (shape.density ?? 1) * (0.94 + 0.16 * random()),
      seed: four(random),
      extra: cut.uv,
      field,
      from: [0.2 + 0.6 * random(), 0.2 + 0.6 * random()],
      delay: delay + i * 70 + 160 * random(),
      lasts: 900 + Math.min(900, Math.max(w, h) * 3),
      grow: 0,
    } satisfies Wash
  })
}

/** Where a hand would rule lines over `length`: near every `unit`, and never quite. */
function lines(length: number, unit: number, random: Random) {
  const count = Math.max(2, Math.round(length / unit))
  const widths = Array.from({ length: count }, () => 0.55 + 0.9 * random())
  const sum = widths.reduce((all, w) => all + w, 0)
  const at = [0]
  for (const w of widths) at.push(at[at.length - 1] + (w / sum) * length)
  return at
}

type Skip = (cell: Rect, u: number, v: number) => boolean

/** A net of small pale squares under a drawing: some are one, some are cut in two, and the edge is as loose as a hand leaves it. */
export function groundOf(rect: Rect, ground: (u: number, v: number) => Pigment, unit: number, random: Random, loose = 0.3, skip?: Skip): Wash[] {
  const washes: Wash[] = []
  const xs = lines(rect.w, unit, random)
  const ys = lines(rect.h, unit * 0.86, random)
  const taken = new Set<string>()
  const columns = xs.length - 1
  const rows = ys.length - 1
  const turn = random() * 6
  const drift = () => (random() - 0.5) * unit * 0.1
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      if (taken.has(`${column},${row}`)) continue
      const across = random() < 0.16 && column + 1 < columns && !taken.has(`${column + 1},${row}`) ? 2 : 1
      const down = across === 1 && random() < 0.12 && row + 1 < rows ? 2 : 1
      for (let i = 0; i < across; i++) for (let j = 0; j < down; j++) taken.add(`${column + i},${row + j}`)
      const edge = row === 0 || column === 0 || row + down === rows || column + across === columns
      if (edge && random() < loose) continue
      const whole = { x: rect.x + xs[column] + drift(), y: rect.y + ys[row] + drift(), w: xs[column + across] - xs[column], h: ys[row + down] - ys[row] }
      const cut = random()
      const at = 0.36 + 0.3 * random()
      const pieces: Rect[] =
        cut < 0.14
          ? [{ ...whole, w: whole.w * at }, { ...whole, x: whole.x + whole.w * at, w: whole.w * (1 - at) }]
          : cut > 0.86
            ? [{ ...whole, h: whole.h * at }, { ...whole, y: whole.y + whole.h * at, h: whole.h * (1 - at) }]
            : [whole]
      const gap = Math.max(1.1, unit * 0.034)
      pieces.forEach((piece, odd) => {
        const cell = { x: piece.x + gap, y: piece.y + gap, w: piece.w - gap * 2, h: piece.h - gap * 2 }
        const u = (cell.x + cell.w / 2 - rect.x) / rect.w
        const v = (cell.y + cell.h / 2 - rect.y) / rect.h
        if (cell.w < 3 || cell.h < 3 || skip?.(cell, u, v)) return
        const [light, warmth] = ground(clamp(u), clamp(v))
        // a patch of another color goes across the net, and here and there is one square of it
        const patch = 0.42 * Math.sin(u * 5.1 - v * 4.3 + turn) + (random() < 0.2 ? 0.8 * (random() - 0.5) : 0)
        const own = warmth + patch + (random() - 0.5) * 0.4 + odd * 0.4 * (random() - 0.5)
        const l = clamp(light + (random() - 0.55) * 0.2 - (random() < 0.12 ? 0.16 : 0))
        washes.push({
          ...cell,
          kind: Kind.Square,
          ink: pigment(l, own),
          ink2: pigment(clamp(l + 0.06), own + (random() - 0.5) * 0.7),
          density: 0.36 + 0.42 * random(),
          seed: four(random),
          extra: [0, 1, 0, 0],
          from: [random(), random()],
          delay: 60 + 700 * Math.hypot(u - 0.5, v - 0.5) * random() + 200 * u,
          lasts: 900,
          grow: 0,
        })
      })
    }
  return washes
}

/** Leaves the paper bare where a light shape is to lie. */
function bareAt(shapes: Shape[], x: number, y: number, k: number): Skip | undefined {
  const bare = shapes.filter((shape) => shape.bare).map((shape) => boundsOf(shape, WHOLE)).filter((box) => box !== undefined)
  if (!bare.length) return undefined
  return (cell) =>
    bare.some((box) => {
      const dx = (cell.x + cell.w / 2 - x) / k - box.x - box.w / 2
      const dy = (cell.y + cell.h / 2 - y) / k - box.y - box.h / 2
      return Math.hypot(dx / (box.w / 2), dy / (box.h / 2)) < 1.05
    })
}

/** The largest place for a whole picture in `rect`, in its middle. */
export function fitted(rect: Rect, across = WHOLE.across, down = WHOLE.down) {
  const k = Math.min(rect.w / across, rect.h / down)
  return { x: rect.x + (rect.w - across * k) / 2, y: rect.y + (rect.h - down * k) / 2, k }
}

/** The whole picture of a piece, given a resolved Picture. */
export function plateFor(box: Rect, picture: Picture, cutter: Cutter, random: Random, small = false): Wash[] {
  const at = fitted(box)
  const unit = clamp(box.w / (small ? 9 : 14), 16, 66)
  return [...groundOf({ x: at.x, y: at.y, w: WHOLE.across * at.k, h: WHOLE.down * at.k }, picture.ground, unit, random, small ? 0.16 : 0.3, bareAt(picture.shapes, at.x, at.y, at.k)), ...laid(picture.shapes, WHOLE, at.x, at.y, at.k, cutter, random, 500)]
}
