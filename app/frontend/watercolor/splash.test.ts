import { describe, expect, it } from 'vitest'
import { Kind, type RGB } from './painter'
import { seeded } from './pigments'
import { splash } from './splash'

function expectValidRgb(rgb: RGB) {
  expect(rgb).toHaveLength(3)
  for (const channel of rgb) {
    expect(Number.isFinite(channel)).toBe(true)
    expect(channel).toBeGreaterThanOrEqual(0)
    expect(channel).toBeLessThanOrEqual(1)
  }
}

describe('splash', () => {
  it('is deterministic for a given seeded generator and varies across seeds', () => {
    const first = splash(240, 180, seeded(42))
    const second = splash(240, 180, seeded(42))
    const other = splash(240, 180, seeded(43))

    expect(first).toEqual(second)
    expect(first).not.toEqual(other)
  })

  it('places a primary puddle centered at (x, y) with zero delay', () => {
    const x = 310
    const y = 145
    const [primary] = splash(x, y, seeded(123))

    expect(primary.kind).toBe(Kind.Puddle)
    expect(primary.delay).toBe(0)
    expect(primary.x + primary.w / 2).toBeCloseTo(x, 6)
    expect(primary.y + primary.h / 2).toBeCloseTo(y, 6)
    expect(primary.w).toBeGreaterThanOrEqual(34)
    expect(primary.w).toBeLessThanOrEqual(96)
    expect(primary.h).toBeGreaterThanOrEqual(primary.w * 0.8)
    expect(primary.h).toBeLessThanOrEqual(primary.w * 1.1)
    expect(primary.still).toBe(true)
    expect(primary.grow).toBe(0)
  })

  it('produces 9 to 17 surrounding puddle drops with positive delays and minimum size >= 3', () => {
    const minDrops = splash(100, 100, () => 0).filter((w, i) => i > 0 && w.kind === Kind.Puddle)
    const maxDrops = splash(100, 100, () => 0.9999).filter((w, i) => i > 0 && w.kind === Kind.Puddle)

    expect(minDrops).toHaveLength(9)
    expect(maxDrops).toHaveLength(17)

    for (let seed = 1; seed <= 40; seed++) {
      const washes = splash(200, 300, seeded(seed))
      const drops = washes.slice(1).filter((w) => w.kind === Kind.Puddle)

      expect(drops.length).toBeGreaterThanOrEqual(9)
      expect(drops.length).toBeLessThanOrEqual(17)
      for (const drop of drops) {
        expect(drop.delay).toBeGreaterThan(0)
        expect(drop.w).toBeGreaterThanOrEqual(3)
        expect(drop.h).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('adds optional Kind.Run streaks starting below the impact point', () => {
    const withoutRuns = splash(150, 220, () => 0).filter((w) => w.kind === Kind.Run)
    const withMaxRuns = splash(150, 220, () => 0.9999).filter((w) => w.kind === Kind.Run)

    expect(withoutRuns).toHaveLength(0)
    expect(withMaxRuns).toHaveLength(2)

    const observedRunCounts = new Set<number>()
    for (let seed = 1; seed <= 40; seed++) {
      const impactY = 260
      const washes = splash(180, impactY, seeded(seed))
      const runs = washes.filter((w) => w.kind === Kind.Run)
      observedRunCounts.add(runs.length)

      expect(runs.length).toBeLessThanOrEqual(2)
      for (const run of runs) {
        expect(run.y).toBeGreaterThan(impactY)
        expect(run.w).toBeGreaterThanOrEqual(3.5)
        expect(run.w).toBeLessThanOrEqual(6.5)
        expect(run.h).toBeGreaterThan(0)
        expect(run.delay).toBeGreaterThan(0)
      }
    }
    expect(observedRunCounts).toEqual(new Set([0, 1, 2]))
  })

  it('preserves valid RGB inks, still: true, and grow: 0 across every generated wash', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const washes = splash(420, 510, seeded(seed))
      for (const wash of washes) {
        expect(wash.still).toBe(true)
        expect(wash.grow).toBe(0)
        expectValidRgb(wash.ink)
        expectValidRgb(wash.ink2)
        expect(wash.seed).toHaveLength(4)
        for (const s of wash.seed) {
          expect(s).toBeGreaterThanOrEqual(0)
          expect(s).toBeLessThan(1)
        }
      }
    }
  })
})
