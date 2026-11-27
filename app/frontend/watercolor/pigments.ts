import type { RGB } from './painter'

export type Random = () => number

/** A small seeded generator, so one visit paints one picture whatever the window does. */
export function seeded(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashOf(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export const four = (random: Random): [number, number, number, number] => [random(), random(), random(), random()]
export const clamp = (x: number, low = 0, high = 1) => Math.min(high, Math.max(low, x))
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (low: number, high: number, x: number) => {
  const t = clamp((x - low) / (high - low))
  return t * t * (3 - 2 * t)
}
export const mixInk = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]

const STEPS = [
  [0, 0.3],
  [0.25, 0.52],
  [0.48, 0.74],
  [0.7, 1],
]
const WARM: RGB[] = [
  [0.4, 0.17, 0.24],
  [0.7, 0.27, 0.22],
  [0.86, 0.5, 0.25],
  [0.95, 0.74, 0.38],
  [0.985, 0.91, 0.66],
]
const COOL: RGB[] = [
  [0.2, 0.23, 0.4],
  [0.22, 0.39, 0.49],
  [0.4, 0.5, 0.48],
  [0.67, 0.73, 0.6],
  [0.9, 0.91, 0.78],
]
const ladder = (steps: RGB[]) => (t: number) =>
  STEPS.reduce<RGB>((ink, [low, high], i) => mixInk(ink, steps[i + 1], smooth(low, high, t)), steps[0])

/** Pigments from dark to light, a warm line and a cool one: the two ladders of the visual. */
export const warm = ladder(WARM)
export const cool = ladder(COOL)
export const pigment = (light: number, warmth: number): RGB =>
  mixInk(cool(light), warm(light), smooth(0.15, 0.85, warmth))
