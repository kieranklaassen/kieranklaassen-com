import { Kind, type Wash } from './painter'
import { four, pigment, type Random } from './pigments'

/** Paint thrown at the paper: where it hit, and what flew on from there. Light enough to be written under. */
export function splash(x: number, y: number, random: Random): Wash[] {
  const warmth = random()
  const ink = () => pigment(0.66 + 0.22 * random(), warmth + 0.3 * (random() - 0.5))
  const puddle = (cx: number, cy: number, w: number, h: number, delay: number, lasts: number): Wash => ({
    x: cx - w / 2, y: cy - h / 2, w, h,
    kind: Kind.Puddle,
    ink: ink(), ink2: ink(),
    density: 0.72,
    seed: four(random),
    extra: [1.8 + 0.5 * random(), 1.0, 0, 0],
    from: [0.5, 0.5],
    delay, lasts,
    grow: 0,
    still: true,
  })
  const size = 34 + 62 * random() ** 1.6
  const washes = [puddle(x, y, size, size * (0.8 + 0.3 * random()), 0, 520)]
  // it flies further one way than the others
  const way = random() * Math.PI * 2
  const count = 9 + Math.floor(random() * 9)
  for (let i = 0; i < count; i++) {
    const angle = way + (random() - 0.5) * (random() < 0.6 ? 1.5 : 6.28)
    const far = size * (0.62 + 2.1 * random() ** 1.7)
    const s = Math.max(3, size * (0.05 + 0.2 * random() ** 2) * (1.25 - Math.min(1, far / (size * 3))))
    washes.push(puddle(x + Math.cos(angle) * far, y + Math.sin(angle) * far, s * (1 + 0.5 * Math.abs(Math.cos(angle)) * random()), s * (1 + 0.5 * Math.abs(Math.sin(angle)) * random()), 30 + far * 1.1, 260))
  }
  // and some of it runs
  const runs = Math.floor(random() * 2.6)
  for (let i = 0; i < runs; i++) {
    const w = 3.5 + 3 * random()
    washes.push({ x: x + (random() - 0.5) * size * 0.5, y: y + size * 0.22, w, h: size * (0.7 + 1.4 * random()), kind: Kind.Run, ink: ink(), ink2: ink(), density: 0.62, seed: four(random), extra: [0, 0, 0, 0], delay: 320 + 200 * random(), lasts: 1900, grow: 0, still: true })
  }
  return washes
}
