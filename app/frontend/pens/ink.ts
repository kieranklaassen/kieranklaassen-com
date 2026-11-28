import { clamp } from '../watercolor/pigments'
import type { Pen, PenName } from './pens'

/** Where the pen was, and how wide its line is there as a share of the pen's width. */
export type Point = [x: number, y: number, wide: number]

/** What a stroke was drawn on. Boxes are as they were then. */
export interface Anchor {
  /** The block, by where it comes in the page and by how its text starts. Minus one is the page itself. */
  block: number
  starts: string
  w: number
  h: number
  /** The letters a stroke runs along, and where they were in the block. */
  words?: { from: number; to: number; x: number; y: number; w: number; h: number }
}

export interface Stroke {
  id: string
  pen: PenName
  colour: string
  /** From the block's top left corner. */
  points: Point[]
  at: Anchor
}

const DOT = 0.01
export const round = (n: number) => Math.round(n * 10) / 10

/** How wide a pen's line is now. A stylus says how hard it is pressed; anything else is thinner when it is fast. */
export function pressed(pen: Pen, { pointerType, pressure }: { pointerType: string; pressure: number }, speed: number, before: number) {
  if (!pen.varies) return 1
  const full = pointerType === 'pen' ? 0.3 + 1.2 * pressure : clamp(1.3 - speed * 0.4, 0.35, 1.3)
  const wide = 1 + (full - 1) * pen.varies
  return pointerType === 'pen' ? wide : before + (wide - before) * 0.35
}

/** A line through points that does not turn at any of them. */
function curve(points: [number, number][] | Point[]) {
  const [first, ...rest] = points
  const last = rest.at(-1)
  if (!last) return ''
  let d = ''
  for (let i = 0; i < rest.length - 1; i++) {
    const [x, y] = rest[i]
    const [nx, ny] = rest[i + 1]
    d += `Q${round(x)} ${round(y)} ${round((x + nx) / 2)} ${round((y + ny) / 2)}`
  }
  return `${round(first[0])} ${round(first[1])}${d}L${round(last[0])} ${round(last[1])}`
}

/** The edge of a line whose width changes as it goes. */
function outline(points: Point[], width: number) {
  const left: [number, number][] = []
  const right: [number, number][] = []
  points.forEach(([x, y, wide], i) => {
    const [bx, by] = points[Math.max(0, i - 1)]
    const [ax, ay] = points[Math.min(points.length - 1, i + 1)]
    const long = Math.hypot(ax - bx, ay - by) || 1
    const off = (width * wide) / 2 / long
    left.push([x - (ay - by) * off, y + (ax - bx) * off])
    right.push([x + (ay - by) * off, y - (ax - bx) * off])
  })
  return `M${curve(left)}L${curve(right.reverse())}Z`
}

/** The path of a stroke, and how wide it is drawn. Without a width it is filled. */
export function inkOf(pen: Pen, points: Point[]): { d: string; width?: number } {
  const { width } = pen
  if (points.length === 1) {
    const [x, y] = points[0]
    const half = pen.chisel ? width / 4 : DOT
    if (!pen.varies) return { d: `M${round(x - half)} ${round(y)}L${x + half} ${round(y)}`, width }
    const r = round((width * points[0][2]) / 2)
    return { d: `M${round(x - r)} ${round(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z` }
  }
  return pen.varies ? { d: outline(points, width) } : { d: `M${curve(points)}`, width }
}

type Spot = readonly [number, number]

function toSegment([x, y]: Spot, [ax, ay]: Spot, [bx, by]: Spot) {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))
  return Math.hypot(x - ax - dx * t, y - ay - dy * t)
}

const side = ([ax, ay]: Spot, [bx, by]: Spot, [x, y]: Spot) => Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax))

/** Whether going from one place to another comes within reach of a stroke. */
export function hits(points: Point[], reach: number, from: Spot, to: Spot) {
  return points.some(([x, y], i) => {
    const a: Spot = [x, y]
    const next = points[i + 1] ?? points[i]
    const b: Spot = [next[0], next[1]]
    if (toSegment(a, from, to) <= reach || toSegment(from, a, b) <= reach || toSegment(to, a, b) <= reach) return true
    return side(a, b, from) * side(a, b, to) < 0 && side(from, to, a) * side(from, to, b) < 0
  })
}
