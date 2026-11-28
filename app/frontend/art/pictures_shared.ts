import { hashOf, seeded } from '../watercolor/pigments'
import { bow, box, crescent, drop, half, heart, leaf, line, oval, perched, quad, stone, waves, wing } from './shapes'

/** A pigment: how light it is, and how warm, each from 0 to 1. */
export type Pigment = [light: number, warmth: number]

export interface Shape {
  d: string
  /** Drawn with a brush this wide, and not filled. */
  brush?: number
  ink: Pigment
  to?: Pigment
  density?: number
  /** The ground is left out under it. */
  bare?: boolean
}

/** A picture on a sheet of 160 by 100, and details of it, each on one of 40 by 40. */
export interface Picture {
  /** What color the ground is, across and down. */
  ground: (u: number, v: number) => Pigment
  shapes: Shape[]
  details: Shape[][]
}

export const NAVY: Pigment = [0.02, 0.05]
export const SEA: Pigment = [0.26, 0.05]
export const MOSS: Pigment = [0.46, 0.15]
export const SAGE: Pigment = [0.68, 0.1]
export const PLUM: Pigment = [0.04, 1]
export const RED: Pigment = [0.24, 1]
export const RUST: Pigment = [0.38, 1]
export const ORANGE: Pigment = [0.52, 1]
export const GOLD: Pigment = [0.74, 1]
export const STRAW: Pigment = [0.93, 1]

export const fill = (d: string, ink: Pigment, to: Pigment = [Math.min(1, ink[0] + 0.14), ink[1] + (ink[1] > 0.5 ? -0.25 : 0.25)], density = 1): Shape => ({ d, ink, to, density })
export const brush = (d: string, wide: number, ink: Pigment, to: Pigment = ink, density = 1): Shape => ({ d, brush: wide, ink, to, density })

export const day = (warmth = 0.6) => (u: number, v: number): Pigment => [0.98 - 0.12 * v - 0.05 * Math.abs(u - 0.5), warmth + 0.3 * Math.sin(u * 4 + v * 3)]
export const dusk = (u: number, v: number): Pigment => [0.94 - 0.16 * Math.abs(v - 0.6), 1.05 - 1.25 * Math.abs(v - 0.68) - 0.1 * u]
export const night = (u: number, v: number): Pigment => [0.46 + 0.4 * v + 0.1 * Math.sin(u * 5), 0.06 + 0.5 * v]
export const bare = (shape: Shape): Shape => ({ ...shape, bare: true })
export const sea = (horizon: number) => (u: number, v: number): Pigment => (v < horizon ? [0.96, 0.75 - 0.3 * u] : [0.78 - 0.2 * (v - horizon), 0.08 + 0.1 * Math.sin(u * 7)])

export const note = (x: number, y: number, s: number, ink: Pigment): Shape[] => [
  fill(oval(x, y, s * 1.25, s * 0.9), ink),
  brush(line(x + s * 1.05, y - s * 0.3, x + s * 1.2, y - s * 5), s * 0.42, ink),
]
export const sprout = (x: number, y: number, s: number, ink: Pigment = MOSS): Shape[] => [
  brush(line(x, y, x - s * 0.06, y - s * 0.5, x + s * 0.05, y - s), s * 0.09, ink),
  fill(leaf(x + s * 0.04, y - s * 0.86, s * 0.7, s * 0.3, -0.7), ink, GOLD),
  fill(leaf(x, y - s * 0.6, s * 0.62, s * 0.28, Math.PI + 0.6), [ink[0] - 0.14, ink[1]], ink),
]
export const boat = (x: number, y: number, s: number, sail: Pigment, jib: Pigment, hull: Pigment): Shape[] => [
  fill(quad(x, y - s * 2, x + s * 1.15, y - s * 0.25, x, y - s * 0.25), sail),
  fill(quad(x - s * 0.1, y - s * 1.7, x - s * 0.1, y - s * 0.25, x - s * 0.85, y - s * 0.25), jib),
  fill(`M${x - s} ${y}L${x + s * 1.2} ${y}Q${x + s * 0.8} ${y + s * 0.55} ${x} ${y + s * 0.55}Q${x - s * 0.8} ${y + s * 0.5} ${x - s} ${y}Z`, hull),
]
export const key = (x: number, y: number, s: number, ink: Pigment, to?: Pigment): Shape[] => [
  brush(oval(x, y, s * 0.8), s * 0.42, ink, to),
  brush(line(x + s * 1.0, y, x + s * 4.1, y), s * 0.4, ink, to),
  fill(box(x + s * 2.9, y, s * 0.45, s * 0.95), ink, to),
  fill(box(x + s * 3.7, y, s * 0.5, s * 1.25), ink, to),
]
export const coin = (x: number, y: number, r: number, ink: Pigment): Shape[] => [
  fill(`${oval(x, y, r)}M${x - r * 0.3} ${y - r * 0.3}L${x - r * 0.3} ${y + r * 0.3}L${x + r * 0.3} ${y + r * 0.3}L${x + r * 0.3} ${y - r * 0.3}Z`, ink),
]
export const button = (x: number, y: number, r: number, ink: Pigment): Shape[] => [
  fill(oval(x, y, r), ink, undefined, 0.85),
  ...[[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].map(([dx, dy]) => fill(oval(x + dx * r, y + dy * r, r * 0.13), NAVY, NAVY)),
]
export const cloud = (x: number, y: number, s: number, ink: Pigment): Shape =>
  fill(`M${x - s * 2} ${y}a${s * 0.8} ${s * 0.8} 0 0 1 ${s * 0.6} ${-s * 0.8}a${s} ${s} 0 0 1 ${s * 1.7} ${-s * 0.5}a${s * 0.95} ${s * 0.95} 0 0 1 ${s * 1.4} ${s * 0.75}a${s * 0.6} ${s * 0.6} 0 0 1 ${s * 0.4} ${s * 0.55}Z`, ink, undefined, 0.8)
export const butterfly = (x: number, y: number, s: number, ink: Pigment, to: Pigment): Shape[] => [
  fill(leaf(x, y, s * 1.35, s * 0.85, -0.85), ink, to),
  fill(leaf(x, y, s * 1.25, s * 0.8, -2.25), ink, to),
  fill(leaf(x, y, s * 0.95, s * 0.62, 0.65), to, ink),
  fill(leaf(x, y, s * 0.9, s * 0.6, 2.4), to, ink),
  brush(line(x, y - s * 0.5, x + s * 0.06, y + s * 0.6), s * 0.16, NAVY),
]
export const ray = (x: number, y: number, from: number, to: number, angle: number, wide: number) => {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return quad(x + c * from - s * wide * 0.35, y + s * from + c * wide * 0.35, x + c * to - s * wide, y + s * to + c * wide, x + c * to + s * wide, y + s * to - c * wide, x + c * from + s * wide * 0.35, y + s * from - c * wide * 0.35)
}
export const tree = (x: number, y: number, s: number, ink: Pigment, up = 1): Shape[] => [
  fill(quad(x - s * 0.12, y, x - s * 0.06, y - up * s * 0.95, x + s * 0.06, y - up * s * 0.95, x + s * 0.14, y), ink),
  brush(line(x, y - up * s * 0.55, x + s * 0.18, y - up * s * 0.8, x + s * 0.42, y - up * s * 1.0), s * 0.07, ink),
  brush(line(x, y - up * s * 0.48, x - s * 0.2, y - up * s * 0.7, x - s * 0.4, y - up * s * 0.86), s * 0.07, ink),
]
export const gem = (x: number, y: number, s: number): Shape[] => {
  const g = 0.035 * s
  const top = y - s * 0.62
  const girdle = y - s * 0.2
  const foot = y + s * 0.85
  const tri = (a: Pigment, b: Pigment, ...p: number[]) => fill(quad(...p), a, b, 1.05)
  return [
    tri(RED, RUST, x - s, girdle - g, x - s * 0.62, top, x - s * 0.36, girdle - g),
    tri(RUST, ORANGE, x - s * 0.56, top, x - s * 0.06, top, x - s * 0.3, girdle - g * 1.4),
    tri(PLUM, RED, x, top + g, x + s * 0.28, girdle - g, x - s * 0.24, girdle - g),
    tri(RED, RUST, x + s * 0.06, top, x + s * 0.56, top, x + s * 0.34, girdle - g * 1.4),
    tri(PLUM, RED, x + s * 0.62, top, x + s, girdle - g, x + s * 0.4, girdle - g),
    tri(PLUM, RED, x - s * 0.98, girdle + g, x - s * 0.36, girdle + g, x - s * 0.06, foot - g),
    tri(RED, ORANGE, x - s * 0.29, girdle + g, x + s * 0.29, girdle + g, x, foot - g * 3),
    tri([0.12, 1], RUST, x + s * 0.36, girdle + g, x + s * 0.98, girdle + g, x + s * 0.06, foot - g),
  ]
}
export const nib = (x: number, y: number, s: number): Shape[] => [
  fill(`M${x - s * 0.5} ${y - s * 2.2}L${x + s * 0.5} ${y - s * 2.2}L${x + s * 0.42} ${y - s * 1.5}L${x - s * 0.42} ${y - s * 1.5}Z`, RED),
  fill(`M${x - s * 0.4} ${y - s * 1.42}L${x - s * 0.06} ${y - s * 1.42}L${x - s * 0.06} ${y - s * 0.2}L${x} ${y}Q${x - s * 0.66} ${y - s * 0.75} ${x - s * 0.4} ${y - s * 1.42}Z`, NAVY, SEA),
  fill(`M${x + s * 0.4} ${y - s * 1.42}L${x + s * 0.06} ${y - s * 1.42}L${x + s * 0.06} ${y - s * 0.2}L${x} ${y}Q${x + s * 0.66} ${y - s * 0.75} ${x + s * 0.4} ${y - s * 1.42}Z`, SEA, NAVY),
]
export const mother = (x: number, y: number, s: number, ink: Pigment = NAVY): Shape[] => [
  fill(perched(x, y, s, 1), ink, [0.2, 0.2]),
]
export const songbird = (x: number, y: number, s: number, ink: Pigment, way = -1): Shape[] => [
  fill(perched(x, y, s, way), ink, RUST),
  brush(line(x, y + s * 0.2, x, y + s * 0.62), s * 0.07, NAVY),
  brush(line(x - s * 0.16 * way, y + s * 0.2, x - s * 0.16 * way, y + s * 0.62), s * 0.07, NAVY),
]
export const spool = (x: number, y: number, s: number, ink: Pigment): Shape[] => [
  fill(box(x - s * 0.8, y - s, s * 1.6, s * 0.3), PLUM),
  fill(box(x - s * 0.8, y + s * 0.7, s * 1.6, s * 0.3), PLUM),
  ...[0, 1, 2, 3].map((i) => fill(quad(x - s * 0.6, y - s * 0.62 + i * s * 0.33, x + s * 0.6, y - s * 0.68 + i * s * 0.33, x + s * 0.6, y - s * 0.42 + i * s * 0.33, x - s * 0.6, y - s * 0.36 + i * s * 0.33), [ink[0] + 0.05 * i, ink[1]])),
]
export const scissors = (x: number, y: number, s: number): Shape[] => [
  fill(quad(x, y - s * 0.16, x + s * 2.5, y - s * 0.95, x + s * 0.2, y + s * 0.22), SEA, SAGE),
  fill(quad(x, y + s * 0.16, x + s * 2.5, y + s * 0.95, x + s * 0.2, y - s * 0.22), NAVY, SEA),
  brush(oval(x - s * 0.82, y - s * 0.62, s * 0.5, s * 0.42), s * 0.3, RED),
  brush(oval(x - s * 0.82, y + s * 0.62, s * 0.5, s * 0.42), s * 0.3, RUST),
]
/** A cell of a net with something small in it. */
export const miniature = (kind: number, x: number, y: number, s: number, a: Pigment, b: Pigment): Shape[] => {
  const r = s * 0.36
  switch (kind % 9) {
    case 0: return [fill(oval(x, y, r), a), fill(oval(x, y, r * 0.42), b)]
    case 1: return [fill(half(x, y + r * 0.1, r, 0), a), fill(half(x, y + r * 0.2, r, Math.PI), b)]
    case 2: return [fill(leaf(x - r, y + r * 0.6, r * 2.3, r * 0.9, -0.55), a)]
    case 3: return [fill(box(x - r, y - r, r * 0.9, r * 2), a), fill(box(x + r * 0.1, y - r * 0.4, r * 0.9, r * 1.4), b)]
    case 4: return [fill(quad(x - r, y + r, x + r, y + r, x, y - r), a)]
    case 5: return [fill(crescent(x, y, r), a), fill(oval(x + r * 0.5, y, r * 0.22), b)]
    case 6: return [brush(line(x - r, y + r * 0.5, x - r * 0.3, y - r * 0.8, x + r * 0.3, y + r * 0.8, x + r, y - r * 0.5), r * 0.36, a)]
    case 7: return [fill(stone(x, y, r, r * 0.8, 1.3), a), fill(oval(x - r * 0.3, y - r * 0.2, r * 0.25), b)]
    default: return [fill(drop(x, y + r * 0.2, r * 0.66), a)]
  }
}
export const puffs = (seed: number, count: number, x: number, y: number, w: number, h: number, inks: Pigment[], low = 0.6, high = 2.4): Shape[] => {
  const random = seeded(seed)
  return Array.from({ length: count }, () => fill(oval(x + w * random(), y + h * random(), low + (high - low) * random() ** 2), inks[Math.floor(random() * inks.length)]))
}

/** A piece nobody has drawn for yet gets a net of miniatures of its own. */
export function found(slug: string): Picture {
  const random = seeded(hashOf(slug))
  const inks: Pigment[] = random() < 0.5 ? [RED, ORANGE, SEA, GOLD, PLUM, RUST] : [NAVY, SEA, MOSS, RUST, GOLD, SAGE]
  const pick = () => inks[Math.floor(random() * inks.length)]
  const shapes: Shape[] = []
  const across = 2 + Math.floor(random() * 3)
  const s = 160 / across
  const down = Math.max(1, Math.round(100 / s))
  const big = random()
  for (let r = 0; r < down; r++)
    for (let c = 0; c < across; c++) {
      if (random() < 0.14) continue
      shapes.push(...miniature(Math.floor(random() * 9), (c + 0.5) * s, ((r + 0.5) / down) * 100, Math.min(s, 100 / down) * (0.82 + 0.3 * big * random()), pick(), pick()))
    }
  return {
    ground: random() < 0.75 ? day(random()) : dusk,
    shapes,
    details: Array.from({ length: 4 }, () => miniature(Math.floor(random() * 9), 20, 20, 36, pick(), pick())),
  }
}

export { bow, box, crescent, drop, half, heart, leaf, line, oval, perched, quad, stone, waves, wing }
