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

const NAVY: Pigment = [0.02, 0.05]
const SEA: Pigment = [0.26, 0.05]
const MOSS: Pigment = [0.46, 0.15]
const SAGE: Pigment = [0.68, 0.1]
const PLUM: Pigment = [0.04, 1]
const RED: Pigment = [0.24, 1]
const RUST: Pigment = [0.38, 1]
const ORANGE: Pigment = [0.52, 1]
const GOLD: Pigment = [0.74, 1]
const STRAW: Pigment = [0.93, 1]

const fill = (d: string, ink: Pigment, to: Pigment = [Math.min(1, ink[0] + 0.14), ink[1] + (ink[1] > 0.5 ? -0.25 : 0.25)], density = 1): Shape => ({ d, ink, to, density })
const brush = (d: string, wide: number, ink: Pigment, to: Pigment = ink, density = 1): Shape => ({ d, brush: wide, ink, to, density })

const day = (warmth = 0.6) => (u: number, v: number): Pigment => [0.98 - 0.12 * v - 0.05 * Math.abs(u - 0.5), warmth + 0.3 * Math.sin(u * 4 + v * 3)]
const dusk = (u: number, v: number): Pigment => [0.94 - 0.16 * Math.abs(v - 0.6), 1.05 - 1.25 * Math.abs(v - 0.68) - 0.1 * u]
const night = (u: number, v: number): Pigment => [0.46 + 0.4 * v + 0.1 * Math.sin(u * 5), 0.06 + 0.5 * v]
const bare = (shape: Shape): Shape => ({ ...shape, bare: true })
const sea = (horizon: number) => (u: number, v: number): Pigment => (v < horizon ? [0.96, 0.75 - 0.3 * u] : [0.78 - 0.2 * (v - horizon), 0.08 + 0.1 * Math.sin(u * 7)])

const note = (x: number, y: number, s: number, ink: Pigment): Shape[] => [
  fill(oval(x, y, s * 1.25, s * 0.9), ink),
  brush(line(x + s * 1.05, y - s * 0.3, x + s * 1.2, y - s * 5), s * 0.42, ink),
]
const sprout = (x: number, y: number, s: number, ink: Pigment = MOSS): Shape[] => [
  brush(line(x, y, x - s * 0.06, y - s * 0.5, x + s * 0.05, y - s), s * 0.09, ink),
  fill(leaf(x + s * 0.04, y - s * 0.86, s * 0.7, s * 0.3, -0.7), ink, GOLD),
  fill(leaf(x, y - s * 0.6, s * 0.62, s * 0.28, Math.PI + 0.6), [ink[0] - 0.14, ink[1]], ink),
]
const boat = (x: number, y: number, s: number, sail: Pigment, jib: Pigment, hull: Pigment): Shape[] => [
  fill(quad(x, y - s * 2, x + s * 1.15, y - s * 0.25, x, y - s * 0.25), sail),
  fill(quad(x - s * 0.1, y - s * 1.7, x - s * 0.1, y - s * 0.25, x - s * 0.85, y - s * 0.25), jib),
  fill(`M${x - s} ${y}L${x + s * 1.2} ${y}Q${x + s * 0.8} ${y + s * 0.55} ${x} ${y + s * 0.55}Q${x - s * 0.8} ${y + s * 0.5} ${x - s} ${y}Z`, hull),
]
const key = (x: number, y: number, s: number, ink: Pigment, to?: Pigment): Shape[] => [
  brush(oval(x, y, s * 0.8), s * 0.42, ink, to),
  brush(line(x + s * 1.0, y, x + s * 4.1, y), s * 0.4, ink, to),
  fill(box(x + s * 2.9, y, s * 0.45, s * 0.95), ink, to),
  fill(box(x + s * 3.7, y, s * 0.5, s * 1.25), ink, to),
]
const coin = (x: number, y: number, r: number, ink: Pigment): Shape[] => [
  fill(`${oval(x, y, r)}M${x - r * 0.3} ${y - r * 0.3}L${x - r * 0.3} ${y + r * 0.3}L${x + r * 0.3} ${y + r * 0.3}L${x + r * 0.3} ${y - r * 0.3}Z`, ink),
]
const button = (x: number, y: number, r: number, ink: Pigment): Shape[] => [
  fill(oval(x, y, r), ink, undefined, 0.85),
  ...[[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].map(([dx, dy]) => fill(oval(x + dx * r, y + dy * r, r * 0.13), NAVY, NAVY)),
]
const cloud = (x: number, y: number, s: number, ink: Pigment): Shape =>
  fill(`M${x - s * 2} ${y}a${s * 0.8} ${s * 0.8} 0 0 1 ${s * 0.6} ${-s * 0.8}a${s} ${s} 0 0 1 ${s * 1.7} ${-s * 0.5}a${s * 0.95} ${s * 0.95} 0 0 1 ${s * 1.4} ${s * 0.75}a${s * 0.6} ${s * 0.6} 0 0 1 ${s * 0.4} ${s * 0.55}Z`, ink, undefined, 0.8)
const butterfly = (x: number, y: number, s: number, ink: Pigment, to: Pigment): Shape[] => [
  fill(leaf(x, y, s * 1.35, s * 0.85, -0.85), ink, to),
  fill(leaf(x, y, s * 1.25, s * 0.8, -2.25), ink, to),
  fill(leaf(x, y, s * 0.95, s * 0.62, 0.65), to, ink),
  fill(leaf(x, y, s * 0.9, s * 0.6, 2.4), to, ink),
  brush(line(x, y - s * 0.5, x + s * 0.06, y + s * 0.6), s * 0.16, NAVY),
]
const ray = (x: number, y: number, from: number, to: number, angle: number, wide: number) => {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return quad(x + c * from - s * wide * 0.35, y + s * from + c * wide * 0.35, x + c * to - s * wide, y + s * to + c * wide, x + c * to + s * wide, y + s * to - c * wide, x + c * from + s * wide * 0.35, y + s * from - c * wide * 0.35)
}
const tree = (x: number, y: number, s: number, ink: Pigment, up = 1): Shape[] => [
  fill(quad(x - s * 0.12, y, x - s * 0.06, y - up * s * 0.95, x + s * 0.06, y - up * s * 0.95, x + s * 0.14, y), ink),
  brush(line(x, y - up * s * 0.55, x + s * 0.18, y - up * s * 0.8, x + s * 0.42, y - up * s * 1.0), s * 0.07, ink),
  brush(line(x, y - up * s * 0.48, x - s * 0.2, y - up * s * 0.7, x - s * 0.4, y - up * s * 0.86), s * 0.07, ink),
]
const gem = (x: number, y: number, s: number): Shape[] => {
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
const nib = (x: number, y: number, s: number): Shape[] => [
  fill(`M${x - s * 0.5} ${y - s * 2.2}L${x + s * 0.5} ${y - s * 2.2}L${x + s * 0.42} ${y - s * 1.5}L${x - s * 0.42} ${y - s * 1.5}Z`, RED),
  fill(`M${x - s * 0.4} ${y - s * 1.42}L${x - s * 0.06} ${y - s * 1.42}L${x - s * 0.06} ${y - s * 0.2}L${x} ${y}Q${x - s * 0.66} ${y - s * 0.75} ${x - s * 0.4} ${y - s * 1.42}Z`, NAVY, SEA),
  fill(`M${x + s * 0.4} ${y - s * 1.42}L${x + s * 0.06} ${y - s * 1.42}L${x + s * 0.06} ${y - s * 0.2}L${x} ${y}Q${x + s * 0.66} ${y - s * 0.75} ${x + s * 0.4} ${y - s * 1.42}Z`, SEA, NAVY),
]
const mother = (x: number, y: number, s: number, ink: Pigment = NAVY): Shape[] => [
  fill(perched(x, y, s, 1), ink, [0.2, 0.2]),
]
const songbird = (x: number, y: number, s: number, ink: Pigment, way = -1): Shape[] => [
  fill(perched(x, y, s, way), ink, RUST),
  brush(line(x, y + s * 0.2, x, y + s * 0.62), s * 0.07, NAVY),
  brush(line(x - s * 0.16 * way, y + s * 0.2, x - s * 0.16 * way, y + s * 0.62), s * 0.07, NAVY),
]
const spool = (x: number, y: number, s: number, ink: Pigment): Shape[] => [
  fill(box(x - s * 0.8, y - s, s * 1.6, s * 0.3), PLUM),
  fill(box(x - s * 0.8, y + s * 0.7, s * 1.6, s * 0.3), PLUM),
  ...[0, 1, 2, 3].map((i) => fill(quad(x - s * 0.6, y - s * 0.62 + i * s * 0.33, x + s * 0.6, y - s * 0.68 + i * s * 0.33, x + s * 0.6, y - s * 0.42 + i * s * 0.33, x - s * 0.6, y - s * 0.36 + i * s * 0.33), [ink[0] + 0.05 * i, ink[1]])),
]
const scissors = (x: number, y: number, s: number): Shape[] => [
  fill(quad(x, y - s * 0.16, x + s * 2.5, y - s * 0.95, x + s * 0.2, y + s * 0.22), SEA, SAGE),
  fill(quad(x, y + s * 0.16, x + s * 2.5, y + s * 0.95, x + s * 0.2, y - s * 0.22), NAVY, SEA),
  brush(oval(x - s * 0.82, y - s * 0.62, s * 0.5, s * 0.42), s * 0.3, RED),
  brush(oval(x - s * 0.82, y + s * 0.62, s * 0.5, s * 0.42), s * 0.3, RUST),
]
/** A cell of a net with something small in it. */
const miniature = (kind: number, x: number, y: number, s: number, a: Pigment, b: Pigment): Shape[] => {
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
const puffs = (seed: number, count: number, x: number, y: number, w: number, h: number, inks: Pigment[], low = 0.6, high = 2.4): Shape[] => {
  const random = seeded(seed)
  return Array.from({ length: count }, () => fill(oval(x + w * random(), y + h * random(), low + (high - low) * random() ** 2), inks[Math.floor(random() * inks.length)]))
}

const PICTURES: Record<string, () => Picture> = {
  // A key, and the tokens that fall from it.
  'automatically-add-tokens-to-active-record-models': () => ({
    ground: day(0.25),
    shapes: [
      ...key(34, 38, 15, NAVY, SEA),
      ...coin(30, 78, 10, GOLD), ...coin(57, 86, 7, ORANGE), ...coin(82, 74, 11, RUST), ...coin(108, 88, 6.5, GOLD), ...coin(131, 77, 10, ORANGE),
      fill(oval(146, 16, 4.5), RED), ...coin(122, 18, 5, STRAW),
    ],
    details: [[...key(9, 18, 6.5, NAVY, SEA)], [...coin(14, 14, 9, GOLD), ...coin(28, 27, 7, RUST)], [...coin(20, 20, 13, ORANGE)], [...coin(10, 28, 6, RUST), ...coin(22, 18, 6, GOLD), ...coin(33, 9, 5, ORANGE)]],
  }),
  // A house laid of blocks, its window a heart.
  'building-software-we-love': () => ({
    ground: day(0.8),
    shapes: [
      fill(oval(126, 24, 13), GOLD, ORANGE),
      fill(quad(40, 46, 79, 12, 79, 46), RED, RUST), fill(quad(81, 12, 120, 46, 81, 46), PLUM, RED),
      fill(box(48, 48, 22, 20), ORANGE), fill(box(72, 48, 17, 20), RUST), fill(box(91, 48, 21, 20), GOLD),
      fill(box(48, 70, 15, 22), SEA), fill(box(65, 70, 15, 22), NAVY), fill(box(82, 70, 30, 22), MOSS),
      fill(heart(80, 35, 6.5), STRAW, GOLD),
      fill(quad(6, 94, 154, 92, 154, 98, 6, 99), SAGE),
      ...sprout(24, 92, 26), ...sprout(136, 92, 34, [0.36, 0.1]), fill(box(102, 13, 7, 14), NAVY),
    ],
    details: [[fill(heart(20, 18, 11), RED, ORANGE)], [fill(quad(6, 20, 20, 6, 34, 20), RED), fill(box(9, 22, 10, 12), ORANGE), fill(box(21, 22, 10, 12), SEA)], [...sprout(20, 36, 28)], [fill(box(6, 8, 13, 11), GOLD), fill(box(21, 8, 13, 11), RUST), fill(box(6, 21, 8, 12), SEA), fill(box(16, 21, 18, 12), MOSS)]],
  }),
  // A net, and what flies in front of it.
  'capturing-flow': () => ({
    ground: day(0.35),
    shapes: [
      fill('M0 88C24 74 44 82 66 76S120 62 160 72L160 100L0 100Z', MOSS, SAGE, 0.9),
      fill('M0 96C30 86 60 92 92 88S140 82 160 86L160 100L0 100Z', SEA, MOSS),
      brush(line(50, 97, 64, 72, 76, 44), 3, PLUM),
      fill('M78 13C56 12 40 20 26 34C40 42 62 42 78 43Z', [0.8, 0.1], SAGE, 0.8),
      brush(oval(79, 28, 9, 16), 2.6, RED),
      ...[0, 1, 2].map((i) => brush(line(74, 18 + i * 9, 54, 20 + i * 8, 32 + i * 2, 32 + i * 2), 0.8, SEA)), ...[0, 1].map((i) => brush(line(64 - i * 14, 15 + i * 5, 61 - i * 14, 28 + i * 2, 63 - i * 14, 42 - i), 0.8, SEA)),
      ...butterfly(122, 26, 15, ORANGE, RED), ...butterfly(146, 52, 8, GOLD, RUST), ...butterfly(102, 12, 6, SEA, NAVY),
      fill(oval(16, 16, 9), GOLD, STRAW),
    ],
    details: [[...butterfly(20, 20, 13, ORANGE, RED)], [...[7, 12, 17].map((r, i) => brush(bow(6, 20, r, -0.8, 0.8), 2, [SEA, MOSS, GOLD][i]))], [...butterfly(12, 26, 8, GOLD, RUST), ...butterfly(28, 12, 6, SEA, NAVY)], [fill(leaf(4, 34, 40, 12, -0.8), MOSS, GOLD), brush(line(4, 34, 30, 8), 0.9, NAVY)]],
  }),
  // The sun comes up, and every ray is another thing to do.
  enthusiasm: () => ({
    ground: dusk,
    shapes: [
      ...Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI + 0.14 + (i / 12) * (Math.PI - 0.28)
        return fill(ray(80, 76, 34, 50 + 22 * Math.abs(Math.sin(i * 2.3)), a, 2.2 + 1.6 * Math.abs(Math.sin(i * 1.7))), [RED, GOLD, RUST, ORANGE, PLUM, SEA][i % 6])
      }),
      fill(half(80, 76, 29), ORANGE, GOLD), fill(half(80, 76, 17), RED, ORANGE),
      fill('M0 78L160 77L160 86L0 87Z', SEA, MOSS), fill('M0 89L160 87L160 100L0 100Z', NAVY, SEA),
      ...puffs(5, 14, 6, 6, 148, 50, [RED, GOLD, SEA, RUST], 0.8, 2.6),
    ],
    details: [[fill(half(20, 26, 10), ORANGE), ...Array.from({ length: 7 }, (_, i) => fill(ray(20, 26, 12.5, 18, Math.PI + 0.2 + i * 0.45, 1.3), [RED, GOLD, RUST][i % 3]))], [...Array.from({ length: 9 }, (_, i) => fill(ray(20, 20, 5, 14, i * 0.7, 2), [RED, GOLD, ORANGE][i % 3]))], [...puffs(9, 9, 6, 6, 28, 28, [RED, GOLD, SEA, RUST], 1.5, 4.5)], [...Array.from({ length: 5 }, (_, i) => fill(leaf(20, 34, 26, 5, -2.5 + i * 0.5), [RED, ORANGE, GOLD, ORANGE, RUST][i]))]],
  }),
  // Rain through a sieve: it goes in as noise and comes out as waves.
  'filtering-noise-with-supercollider': () => ({
    ground: (u, v) => [0.95 - 0.25 * v, 0.2 + 0.25 * Math.sin(u * 5)],
    shapes: [
      ...puffs(21, 74, 8, 3, 144, 34, [NAVY, SEA, MOSS, PLUM, RUST, GOLD], 0.6, 2.8),
      ...Array.from({ length: 12 }, (_, i) => fill(box(10 + i * 11.8, 44 + Math.sin(i) * 0.8, 8.8, 5), i % 4 === 1 ? RED : NAVY)),
      ...[20, 43, 67, 91, 115, 138].map((x, i) => fill(drop(x, 58 + (i % 2) * 5, 2.6), SEA)),
      fill(waves(0, 72, 160, 10, 4, 12), SAGE, MOSS, 0.8), fill(waves(0, 80, 160, 12, 4, 10), SEA, MOSS, 0.9), fill(waves(0, 89, 160, 11, 4, 8), NAVY, SEA),
    ],
    details: [[...puffs(3, 22, 4, 4, 32, 32, [NAVY, SEA, RUST, GOLD], 0.7, 2.8)], [fill(drop(20, 23, 9), SEA, NAVY)], [fill(waves(2, 14, 36, 7, 3, 8), SEA), fill(waves(2, 24, 36, 8, 3, 7), NAVY)], [fill(drop(10, 14, 4), SEA), fill(drop(22, 25, 5), NAVY), fill(drop(32, 12, 3.5), MOSS)]],
  }),
  // The day in boxes, and the bird that leaves by the one left open.
  'finding-freedom-in-structure': () => ({
    ground: day(0.5),
    shapes: [
      ...Array.from({ length: 15 }, (_, i) => {
        const c = i % 5
        const r = Math.floor(i / 5)
        return i === 4 || i === 9 ? [] : [fill(box(10 + c * 21, 12 + r * 27, 17, 22), ([NAVY, SEA, MOSS, SAGE, SEA] as Pigment[])[(i * 7) % 5], undefined, 0.9)]
      }).flat(),
      brush(box(95, 13, 15, 21), 1.6, NAVY), brush(box(95, 40, 15, 21), 1.6, NAVY),
      fill(quad(112, 40, 122, 44, 122, 68, 112, 62), SEA, SAGE),
      fill(wing(130, 30, 22, -0.35), RED, ORANGE), fill(wing(150, 58, 7, -0.2), GOLD, RUST),
    ],
    details: [[fill(wing(20, 24, 15, -0.3), RED, ORANGE)], [brush(box(7, 7, 11, 11), 1.8, NAVY), fill(box(22, 7, 11, 11), SEA), fill(box(7, 22, 11, 11), MOSS), brush(box(22, 22, 11, 11), 1.8, NAVY)], [fill(wing(12, 28, 8, -0.3), GOLD, RUST), fill(wing(28, 14, 7, -0.5), RED, RUST)], [fill(leaf(6, 32, 34, 7, -0.75), RED, ORANGE), brush(line(4, 34, 30, 9), 0.9, PLUM)]],
  }),
  // A nib in the ground. What is written takes root.
  'grounding-ideas-in-writing': () => ({
    ground: (u, v) => (v < 0.56 ? [0.98, 0.7 - 0.3 * u] : [0.82 - 0.2 * v, 0.9 - 0.2 * u]),
    shapes: [
      cloud(32, 24, 9, [0.72, 0.05]), cloud(128, 18, 7, [0.78, 0.05]),
      fill('M0 57C30 54 60 58 80 56S130 54 160 57L160 64L0 64Z', RUST, PLUM, 0.9),
      ...nib(80, 60, 22),
      ...[[-1, 34, 10], [-1, 22, 24], [1, 36, 12], [1, 20, 26], [-1, 8, 34], [1, 7, 30]].map(([way, w, h]) => brush(line(80, 60, 80 + way * w * 0.3, 60 + h * 0.6, 80 + way * w, 64 + h * 0.8, 80 + way * (w + 10), 62 + h), 1.6, PLUM, RUST)),
      ...sprout(48, 57, 22), ...sprout(112, 57, 28, [0.4, 0.15]), ...sprout(140, 57, 16), ...sprout(22, 57, 15, [0.38, 0.1]),
      ...puffs(8, 9, 10, 70, 140, 26, [GOLD, PLUM, RUST], 1, 2.6),
    ],
    details: [[...nib(20, 36, 14.5)], [...sprout(20, 36, 28)], [cloud(22, 18, 8, [0.6, 0.05]), fill(drop(13, 29, 2), SEA), fill(drop(21, 33, 2), SEA), fill(drop(29, 28, 2), SEA)], [...[[-1, 12, 22], [1, 13, 24], [-1, 4, 30], [1, 3, 22]].map(([way, w, h]) => brush(line(20, 4, 20 + way * w * 0.4, 4 + h * 0.6, 20 + way * w, 4 + h), 1.7, PLUM, RUST))]],
  }),
  // A tree by the water. Its reflection is made of squares.
  'how-ai-reflects-my-brain': () => ({
    ground: sea(0.52),
    shapes: [
      ...tree(80, 52, 40, PLUM),
      fill(stone(80, 20, 17, 14, 1.2), ORANGE, GOLD, 0.9), fill(stone(60, 26, 14, 11, 2), RUST, ORANGE, 0.9), fill(stone(101, 24, 15, 12, 1.6), RED, ORANGE, 0.9), fill(stone(91, 12, 11, 9, 2.4), GOLD, STRAW, 0.9), fill(stone(68, 13, 10, 8, 1), RED, RUST, 0.9),
      fill('M0 51L160 50L160 53.500L0 54.500Z', NAVY, SEA),
      ...Array.from({ length: 5 }, (_, i) => fill(box(78 + (i % 2) * 1.2, 56 + i * 5, 4.6, 4.2), NAVY)),
      ...Array.from({ length: 44 }, (_, i) => {
        const a = i * 2.399
        const r = 3.5 * Math.sqrt(i)
        return fill(box(Math.round((80 + r * 1.2 * Math.cos(a)) / 6) * 6 - 2.6, Math.round((82 + r * 0.62 * Math.sin(a)) / 5.4) * 5.4 - 2.4, 5.1, 4.6), [SEA, NAVY, MOSS, SAGE, SEA, RUST][i % 6], undefined, 0.62)
      }),
    ],
    details: [[...tree(20, 37, 24, PLUM), fill(stone(20, 13, 12, 9, 1.4), ORANGE, GOLD)], [...Array.from({ length: 12 }, (_, i) => fill(box(6 + (i % 4) * 7.2, 9 + Math.floor(i / 4) * 7.6, 6, 6.4), [SEA, NAVY, MOSS, SAGE][(i * 5) % 4]))], [fill(leaf(8, 32, 32, 9, -0.75), RED, GOLD)], [fill(stone(14, 22, 9, 8, 1.2), ORANGE), fill(box(24, 10, 6, 6), SEA), fill(box(24, 18, 6, 6), NAVY), fill(box(24, 26, 6, 6), MOSS)]],
  }),
  // What was cut.
  'i-wrote-a-gem-it-runs-instance-methods-in-a-job': () => ({
    ground: (u, v) => [0.97 - 0.1 * v, 0.2 + 0.3 * Math.sin(u * 4 + 1)],
    shapes: [
      ...gem(80, 48, 44),
      ...gem(22, 74, 11), ...gem(140, 26, 9),
      ...[[124, 70, 8], [38, 22, 9], [146, 84, 5], [16, 40, 5]].map(([x, y, s]) => fill(`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`, GOLD, ORANGE)),
      brush(line(20, 96, 80, 93, 146, 95), 1.4, SEA),
    ],
    details: [[...gem(20, 19, 17)], [fill('M20 4Q20 20 36 20Q20 20 20 36Q20 20 4 20Q20 20 20 4Z', GOLD, ORANGE)], [...gem(12, 25, 9), ...gem(29, 13, 7)], [fill(quad(4, 18, 18, 6, 16, 22), RED), fill(quad(20, 6, 36, 16, 19, 22), RUST), fill(quad(17, 25, 34, 20, 22, 36), PLUM), fill(quad(5, 21, 14, 25, 18, 35), ORANGE)]],
  }),
  // It is very large, and it is only a bird too.
  'silencing-your-inner-critic': () => ({
    ground: night,
    shapes: [
      bare(fill(oval(56, 44, 39), STRAW, GOLD, 0.95)),
      ...mother(56, 52, 43),
      brush(line(0, 72, 60, 76, 110, 74, 160, 70), 1.6, PLUM),
      ...songbird(124, 65, 12, GOLD),
      ...note(106, 40, 2.6, RED), ...note(119, 27, 2.2, ORANGE), ...note(136, 36, 2.9, RUST), ...note(148, 17, 2.1, GOLD),
      fill(oval(81.500, 26, 1.6), STRAW, STRAW, 0.4),
    ],
    details: [[...songbird(20, 18, 15, GOLD)], [...note(12, 30, 3.2, RED), ...note(26, 24, 2.8, ORANGE)], [fill(perched(20, 22, 18), NAVY)], [fill(leaf(6, 34, 38, 6, -0.85), NAVY, SEA), brush(line(4, 36, 30, 7), 0.8, PLUM)]],
  }),
  // A net, and in every window another miniature.
  'systems-structure-and-creative-freedom': () => ({
    ground: day(0.7),
    shapes: Array.from({ length: 15 }, (_, i) => {
      const inks: Pigment[] = [RED, SEA, ORANGE, NAVY, GOLD, MOSS, PLUM, RUST]
      return miniature((i * 4 + 3) % 9, 17 + (i % 5) * 31.5 + (i === 7 ? 5 : 0), 18 + Math.floor(i / 5) * 32 + (i === 7 ? -6 : 0), i === 7 ? 44 : 27, inks[(i * 3) % 8], inks[(i * 3 + 4) % 8])
    }).flat(),
    details: [0, 5, 1, 6].map((kind, i) => miniature(kind, 20, 20, 36, [RED, SEA, NAVY, ORANGE][i], [GOLD, ORANGE, RUST, SEA][i])),
  }),
  // Five boats and one wind.
  'the-importance-of-team-alignment-in-teams': () => ({
    ground: sea(0.5),
    shapes: [
      fill(oval(134, 20, 11), ORANGE, GOLD),
      ...boat(24, 60, 13, GOLD, STRAW, PLUM), ...boat(52, 54, 11, ORANGE, GOLD, RED), ...boat(82, 62, 15, RED, RUST, NAVY), ...boat(112, 54, 11, RUST, ORANGE, PLUM), ...boat(140, 61, 13, SEA, SAGE, RED),
      fill(waves(0, 70, 160, 10, 6, 6), MOSS, SAGE, 0.8), fill(waves(0, 79, 160, 10, 5, 7), SEA, MOSS, 0.9), fill(waves(0, 89, 160, 11, 6, 6), NAVY, SEA),
      fill(wing(40, 18, 8, -0.1), NAVY), fill(wing(60, 10, 6, -0.2), NAVY), fill(wing(26, 9, 5, 0), NAVY),
    ],
    details: [[...boat(18, 27, 12, RED, RUST, NAVY)], [fill(waves(2, 14, 36, 6, 3, 6), SEA), fill(waves(2, 23, 36, 8, 4, 6), NAVY)], [...boat(10, 30, 7, GOLD, STRAW, PLUM), ...boat(27, 22, 7, ORANGE, GOLD, RED)], [fill(wing(12, 12, 8, 0), NAVY), fill(wing(27, 24, 7, -0.3), SEA)]],
  }),
  // Stone upon stone, and one leaf more than yesterday.
  'the-joy-of-micro-improvement': () => ({
    ground: day(0.4),
    shapes: [
      fill(oval(132, 22, 10), GOLD, STRAW),
      fill('M0 84C40 76 110 86 160 79L160 100L0 100Z', SAGE, MOSS, 0.9),
      fill(stone(80, 82, 30, 9.500, 1.1), NAVY, SEA), fill(stone(77, 66, 22, 7.5, 1.7), RUST, ORANGE), fill(stone(82, 53, 16, 6.2, 2.1), SEA, MOSS), fill(stone(79, 42.5, 11, 4.8, 1.3), GOLD, ORANGE), fill(stone(81, 34.5, 7, 3.6, 2.6), PLUM, RED),
      ...sprout(80, 31, 21),
      ...[14, 27, 38, 47].map((x, i) => sprout(x, 86 - i, 22 - i * 4.6, [0.4 + i * 0.04, 0.12])).flat(),
      fill(stone(118, 88, 9, 4, 1.9), MOSS), fill(stone(138, 90, 6, 3, 1.2), RUST),
    ],
    details: [[fill(stone(20, 33, 14, 4.6, 1.1), NAVY), fill(stone(19, 25, 10, 3.8, 1.7), RUST), fill(stone(21, 18.5, 7, 3, 2.1), SEA), ...sprout(20, 15, 12)], [...sprout(20, 36, 30)], [...[8, 18, 30].map((x, i) => sprout(x, 34, 10 + i * 8)).flat()], [fill(stone(13, 24, 9, 6, 1.2), RUST), fill(stone(29, 19, 7, 5, 1.8), SEA)]],
  }),
  // Cut to measure.
  'tool-tailor': () => ({
    ground: day(0.55),
    shapes: [
      fill(quad(6, 62, 60, 56, 96, 66, 154, 58, 154, 98, 6, 98), [0.8, 0.95], [0.7, 0.9], 0.6),
      ...scissors(34, 34, 18),
      brush(line(128, 34, 150, 44, 138, 60, 108, 62, 92, 76, 112, 88, 146, 82), 1.3, RED),
      ...spool(128, 24, 13, RED),
      brush(line(140, 88, 152, 72), 1.7, NAVY),
      ...button(22, 80, 9, SEA), ...button(46, 76, 7, GOLD), ...button(66, 84, 8.5, RUST),
      ...Array.from({ length: 9 }, (_, i) => fill(box(8 + i * 10, 64 + Math.sin(i * 0.9) * 1.5, 5.6, 1.3), NAVY)),
    ],
    details: [[...scissors(14, 20, 8.5)], [...button(20, 20, 14, SEA)], [...spool(20, 20, 13, RED)], [...button(13, 14, 8, GOLD), ...button(28, 25, 7, RUST)]],
  }),
  // Breath: two lungs of leaves, and what they open.
  'unlocking-ideas': () => ({
    ground: dusk,
    shapes: [
      fill(oval(80, 25, 10), GOLD, ORANGE),
      ...[15, 20, 25].map((r, i) => brush(bow(80, 25, r, Math.PI * 1.06, Math.PI * 1.94), 1.5, [ORANGE, GOLD, RUST][i])),
      brush(line(80, 40, 79, 60, 81, 98), 2.2, PLUM),
      ...[1, -1].flatMap((way) =>
        [[48, -0.8, 30, 7], [55, -0.42, 44, 9.5], [63, -0.1, 52, 10], [72, 0.16, 50, 10], [80, 0.36, 40, 8.5], [88, 0.55, 26, 6.500]].map(([y, angle, long, wide], i) =>
          fill(leaf(80 + way * 2, y, long, wide, way > 0 ? angle : Math.PI - angle), ([SAGE, MOSS, SEA, MOSS, [0.16, 0.2], SEA] as Pigment[])[(i + (way > 0 ? 0 : 1)) % 6], undefined, 0.95),
        ),
      ),
      ...key(12, 22, 5.5, RED, RUST), ...puffs(17, 9, 118, 8, 34, 26, [GOLD, RED, ORANGE], 1, 2.4),
    ],
    details: [[...[-2.3, -1.95, -1.57, -1.2, -0.85].map((a, i) => fill(leaf(20, 37, 30, 5.5, a), [SAGE, MOSS, SEA, MOSS, [0.16, 0.2] as Pigment][i]))], [...[6, 11, 16].map((r, i) => brush(oval(20, 20, r), 1.7, [RED, ORANGE, GOLD][i]))], [...key(10, 18, 6, RED, RUST)], [fill(leaf(5, 34, 40, 11, -0.82), SEA, SAGE), brush(line(5, 34, 31, 7), 0.9, NAVY)]],
  }),
  // The sea by night, and three notes for the three tracks.
  'whispers-of-silece-ep': () => ({
    ground: (u, v) => (v < 0.6 ? [0.4 + 0.75 * v + 0.06 * Math.sin(u * 6), 0.02 + 1.5 * v * v] : [0.7 - 0.2 * v, 0.08]),
    shapes: [
      bare(fill(crescent(112, 27, 19, -0.5), GOLD, ORANGE)),
      fill(waves(0, 64, 160, 10, 3, 5), SEA, MOSS, 0.75), fill(waves(0, 73, 160, 12, 4, 6), NAVY, SEA, 0.85), fill(waves(0, 85, 160, 15, 3, 6), [0.02, 0.2], SEA),
      ...[0, 1, 2, 3, 4].map((i) => fill(leaf(97 - i * 2.5, 68 + i * 6.4, 20 + i * 5, 1.5, 0.02), STRAW, GOLD, 0.8)),
      ...note(30, 52, 4.4, PLUM), ...note(51, 44, 4.4, RED), ...note(72, 50, 4.4, RUST),
      ...puffs(33, 15, 4, 3, 152, 32, [STRAW, GOLD], 0.5, 1.2),
    ],
    details: [[fill(crescent(19, 20, 14, -0.5), GOLD, STRAW)], [...note(10, 30, 3.4, ORANGE), ...note(20, 25, 3.4, RED), ...note(31, 28, 3.4, RUST)], [fill(waves(2, 15, 36, 7, 2, 7), SEA), fill(waves(2, 25, 36, 8, 2, 7), NAVY)], [...note(19, 29, 5, RED)]],
  }),
  // Looked at until it shines.
  'every-how-i-polish-software-that-agents-built': () => ({
    ground: day(0.3),
    shapes: [
      fill(oval(80, 56, 35, 31), SEA, NAVY), fill(leaf(58, 48, 30, 6, -0.75), STRAW, STRAW, 0.5),
      ...[[122, 24, 13], [36, 28, 9], [134, 66, 7], [28, 70, 6]].map(([x, y, s]) => fill(`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`, ORANGE, RED)),
      fill('M96 84C112 66 128 74 146 86C134 98 106 98 96 84Z', RED, RUST, 0.85), fill('M14 92C50 86 110 90 148 94L148 98L14 98Z', MOSS, SAGE),
    ],
    details: [miniature(7, 20, 20, 36, SEA, STRAW)],
  }),
  // Eight steps where there were four.
  'every-compound-engineering-gets-an-upgrade': () => ({
    ground: day(0.6),
    shapes: [...Array.from({ length: 8 }, (_, i) => fill(box(10 + i * 15.6, 84 - i * 8.6, 13.4, 12 + i * 8.6), [NAVY, SEA, MOSS, SEA, GOLD, ORANGE, RUST, RED][i] as Pigment)), ...sprout(128, 22, 20), fill(oval(28, 26, 11), GOLD, ORANGE)],
    details: [[...sprout(20, 36, 28)]],
  }),
  // A folder, and who lives in it.
  'every-the-folder-is-the-agent': () => ({
    ground: day(0.75),
    shapes: [fill(perched(84, 34, 27), SEA, NAVY), fill(quad(26, 40, 58, 40, 66, 48, 134, 48, 134, 52, 26, 52), RUST, RED), fill(quad(20, 54, 140, 54, 132, 94, 28, 94), ORANGE, GOLD), fill(oval(96.5, 15, 1.7), STRAW), ...puffs(4, 7, 118, 6, 34, 26, [RED, SEA, GOLD], 1, 2.6)],
    details: [[fill(perched(20, 22, 18), SEA)]],
  }),
  // Thirteen eyes.
  'every-i-stopped-reading-code-my-code-reviews-got-better': () => ({
    ground: day(0.25),
    shapes: Array.from({ length: 13 }, (_, i) => {
      const x = i < 4 ? 26 + i * 36 : i < 9 ? 14 + (i - 4) * 33 : 26 + (i - 9) * 36
      const y = i < 4 ? 20 : i < 9 ? 50 : 80
      const ink = [SEA, NAVY, MOSS, RUST, SEA, MOSS, RED, NAVY, SEA, ORANGE, NAVY, MOSS, SEA][i] as Pigment
      return [fill(`M${x - 14} ${y}Q${x} ${y - 13} ${x + 14} ${y}Q${x} ${y + 13} ${x - 14} ${y}Z`, [0.84, ink[1]], SAGE, 0.8), fill(oval(x + (i % 3) * 2 - 2, y, 6), ink), fill(oval(x + (i % 3) * 2 - 2, y, 2.4), NAVY)]
    }).flat(),
    details: [miniature(0, 20, 20, 36, SEA, NAVY)],
  }),
  // It grows on what grew.
  'every-compound-engineering': () => ({
    ground: day(0.5),
    shapes: [fill('M0 84C40 80 110 86 160 81L160 100L0 100Z', RUST, PLUM, 0.9), ...sprout(22, 84, 18), ...sprout(54, 84, 32, [0.42, 0.12]), ...sprout(92, 84, 50, [0.38, 0.1]), ...sprout(128, 84, 60, [0.3, 0.08]), fill(oval(34, 24, 12), GOLD, ORANGE)],
    details: [[...sprout(20, 36, 28)]],
  }),
  // An opus: five lines and what stands on them.
  'every-vibe-check-opus-4-5': () => ({
    ground: day(0.8),
    shapes: [...Array.from({ length: 5 }, (_, i) => brush(line(8, 34 + i * 10, 70, 31 + i * 10.4, 152, 35 + i * 10), 1.2, NAVY)), ...note(30, 74, 6, RED), ...note(56, 64, 6, SEA), ...note(82, 54, 6, ORANGE), ...note(108, 59, 6, PLUM), ...note(134, 44, 6, RUST)],
    details: [[...note(18, 30, 5, RED)]],
  }),
  // The large one shows the small one how.
  'every-teach-your-ai-to-think-like-a-senior-engineer': () => ({
    ground: dusk,
    shapes: [brush(line(4, 78, 60, 81, 110, 78, 156, 80), 2.4, PLUM), fill(perched(56, 58, 33), NAVY, SEA), fill(oval(71.5, 34, 2), STRAW), ...songbird(116, 70, 15, ORANGE), ...songbird(142, 72, 10, GOLD), fill(leaf(14, 80, 22, 6, 0.7), MOSS), fill(leaf(88, 80, 20, 6, 0.9), SEA)],
    details: [[...songbird(20, 18, 15, GOLD)]],
  }),
  // The way, before anybody goes it.
  'every-stop-coding-and-start-planning': () => ({
    ground: day(0.45),
    shapes: [fill(quad(6, 20, 52, 10, 52, 86, 6, 94), [0.86, 0.9], GOLD, 0.8), fill(quad(54, 10, 106, 20, 106, 94, 54, 86), [0.8, 0.2], SAGE, 0.8), fill(quad(108, 20, 154, 10, 154, 86, 108, 94), [0.86, 0.8], STRAW, 0.8), ...[[18, 80], [27, 72], [37, 67], [48, 66], [59, 68], [69, 65], [77, 57], [84, 48], [94, 42], [105, 42], [116, 44], [125, 40]].map(([x, y]) => fill(oval(x, y, 2), NAVY)), fill(`M136 46C124 32 128 18 136 18S148 32 136 46Z`, RED, RUST), fill(oval(136, 27, 3.4), STRAW), fill(oval(30, 36, 9), SEA, SAGE), fill(quad(78, 84, 88, 66, 98, 84), MOSS)],
    details: [miniature(6, 20, 20, 36, RED, GOLD)],
  }),
  // Three lines: five, seven, five.
  'every-vibe-check-claude-haiku-4-5': () => ({
    ground: day(0.6),
    shapes: [5, 7, 5].flatMap((count, row) => Array.from({ length: count }, (_, i) => fill(stone(80 + (i - (count - 1) / 2) * 20, 22 + row * 28, 7.6, 7, i + row + 1), [RED, SEA, GOLD, NAVY, ORANGE, MOSS, PLUM][(i * 3 + row * 2) % 7] as Pigment))),
    details: [miniature(7, 20, 20, 36, RED, GOLD)],
  }),
  // A ladybird on the leaf, gone before you looked.
  'every-my-ai-had-already-fixed-the-code-before-i-saw-it': () => ({
    ground: day(0.15),
    shapes: [fill(leaf(8, 92, 168, 38, -0.5), MOSS, SEA), brush(line(8, 92, 70, 60, 148, 18), 1.6, NAVY), fill(half(92, 40, 18, -0.5), RED, RUST), fill(oval(107, 32, 6), NAVY), ...[[84, 36], [93, 28], [97, 37], [104, 25]].map(([x, y]) => fill(oval(x, y, 2.4), NAVY))],
    details: [miniature(2, 20, 20, 36, MOSS, GOLD)],
  }),
  // One hull, five sails.
  'every-how-i-use-claude-code-to-ship-like-a-team-of-five': () => ({
    ground: sea(0.6),
    shapes: [...[RED, ORANGE, GOLD, RUST, SEA].map((ink, i) => fill(quad(26 + i * 22, 58, 26 + i * 22, 58 - 28 - 9 * Math.sin(i * 0.8), 45 + i * 22, 58), ink as Pigment)), fill('M14 62L146 62Q138 82 112 82L44 82Q22 82 14 62Z', NAVY, PLUM), fill(waves(0, 78, 160, 10, 6, 6), MOSS, SAGE, 0.8), fill(waves(0, 88, 160, 12, 5, 7), SEA, NAVY), fill(wing(138, 18, 9, -0.2), NAVY)],
    details: [[...boat(18, 27, 12, RED, RUST, NAVY)]],
  }),
  // A letter that flies.
  'every-cora-is-out-of-beta': () => ({
    ground: day(0.35),
    shapes: [fill(quad(46, 40, 112, 34, 118, 78, 52, 84), [0.88, 1], STRAW, 0.9), fill(quad(46, 40, 112, 34, 82, 62), RED, RUST), fill(leaf(50, 48, 50, 13, -2.5), SEA, SAGE), fill(leaf(50, 56, 44, 12, -2.9), NAVY, SEA), fill(leaf(112, 42, 50, 13, -0.7), SEA, SAGE), fill(leaf(113, 50, 44, 12, -0.25), NAVY, SEA), cloud(34, 92, 8, SAGE), cloud(132, 88, 7, SAGE)],
    details: [miniature(4, 20, 20, 36, RED, GOLD)],
  }),
  // Ten leaves of one seed.
  'every-how-i-10x-my-engineering-with-ai': () => ({
    ground: day(0.65),
    shapes: [brush(line(80, 96, 78, 60, 82, 18), 2.4, PLUM), ...Array.from({ length: 10 }, (_, i) => fill(leaf(80, 86 - Math.floor(i / 2) * 14, 56 - Math.floor(i / 2) * 7, 9, i % 2 ? Math.PI + 0.45 : -0.45), [SEA, MOSS, RUST, GOLD, SEA, ORANGE, MOSS, RED, SAGE, GOLD][i] as Pigment)), fill(stone(80, 95, 12, 4, 1.2), PLUM)],
    details: [miniature(2, 20, 20, 36, MOSS, GOLD)],
  }),
}

/** A piece nobody has drawn for yet gets a net of miniatures of its own. */
function found(slug: string): Picture {
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

export const pictureOf = (slug: string): Picture => PICTURES[slug]?.() ?? found(slug)
