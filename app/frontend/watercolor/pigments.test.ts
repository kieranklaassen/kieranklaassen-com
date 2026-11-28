import { describe, expect, it } from 'vitest'
import type { RGB } from './painter'
import { clamp, cool, four, hashOf, mix, mixInk, pigment, seeded, smooth, warm } from './pigments'

function expectValidRgb(rgb: RGB) {
  expect(rgb).toHaveLength(3)
  for (const channel of rgb) {
    expect(Number.isFinite(channel)).toBe(true)
    expect(channel).toBeGreaterThanOrEqual(0)
    expect(channel).toBeLessThanOrEqual(1)
  }
}

function expectRgbClose(actual: RGB, expected: RGB) {
  for (let ch = 0; ch < 3; ch++) expect(actual[ch]).toBeCloseTo(expected[ch], 10)
}

const luminance = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b

describe('seeded and hashOf', () => {
  it('produces identical sequences in [0, 1) for the same seed', () => {
    const a = seeded(42)
    const b = seeded(42)
    const seqA = Array.from({ length: 200 }, () => a())
    const seqB = Array.from({ length: 200 }, () => b())

    expect(seqA).toEqual(seqB)
    for (const value of seqA) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('diverges for different seeds and normalizes uint32 edge inputs', () => {
    const zero = seeded(0)
    const one = seeded(1)
    expect(Array.from({ length: 8 }, () => zero())).not.toEqual(Array.from({ length: 8 }, () => one()))

    const neg = seeded(-1)
    const max = seeded(0xffffffff)
    expect(Array.from({ length: 8 }, () => neg())).toEqual(Array.from({ length: 8 }, () => max()))
  })

  it('hashes strings deterministically into unsigned 32-bit integers', () => {
    const samples = ['', 'a', 'b', 'ab', 'ba', 'capturing-flow', 'capturing-flow-2']
    const hashes = samples.map(hashOf)

    expect(samples.map(hashOf)).toEqual(hashes)
    for (const h of hashes) {
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
    }
    expect(new Set(hashes).size).toBe(samples.length)
  })
})

describe('four, clamp, mix, smooth, and mixInk', () => {
  it('reads exactly four values in order from the generator', () => {
    const rng = seeded(7)
    const expected = [rng(), rng(), rng(), rng()]
    expect(four(seeded(7))).toEqual(expected)
  })

  it('clamps to [0, 1] by default and respects custom bounds', () => {
    expect(clamp(-0.5)).toBe(0)
    expect(clamp(0)).toBe(0)
    expect(clamp(0.4)).toBe(0.4)
    expect(clamp(1)).toBe(1)
    expect(clamp(2.5)).toBe(1)

    expect(clamp(-10, -5, 5)).toBe(-5)
    expect(clamp(0, -5, 5)).toBe(0)
    expect(clamp(10, -5, 5)).toBe(5)
  })

  it('interpolates scalars and RGB channels linearly', () => {
    expect(mix(10, 20, 0)).toBe(10)
    expect(mix(10, 20, 0.25)).toBe(12.5)
    expect(mix(10, 20, 1)).toBe(20)
    expect(mix(20, 10, 0.5)).toBe(15)

    const a: RGB = [0.2, 0.4, 0.8]
    const b: RGB = [0.8, 0.6, 0.2]
    expectRgbClose(mixInk(a, b, 0), a)
    expectRgbClose(mixInk(a, b, 1), b)
    expectRgbClose(mixInk(a, b, 0.5), [0.5, 0.5, 0.5])
  })

  it('smoothstep hits boundaries, stays symmetric, and increases monotonically', () => {
    expect(smooth(2, 6, -5)).toBe(0)
    expect(smooth(2, 6, 2)).toBe(0)
    expect(smooth(2, 6, 4)).toBe(0.5)
    expect(smooth(2, 6, 6)).toBe(1)
    expect(smooth(2, 6, 20)).toBe(1)

    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const x = 2 + (4 * i) / 20
      const y = smooth(2, 6, x)
      expect(y).toBeGreaterThan(prev)
      prev = y
    }

    expect(smooth(0, 10, 2.5) + smooth(0, 10, 7.5)).toBeCloseTo(1, 10)
    expect(smooth(10, 0, 10)).toBe(0)
    expect(smooth(10, 0, 5)).toBe(0.5)
    expect(smooth(10, 0, 0)).toBe(1)
  })
})

describe('warm, cool, and pigment', () => {
  it('moves monotonically from dark to light along both ladders and clamps outside [0, 1]', () => {
    for (const ladder of [warm, cool]) {
      expect(ladder(-1)).toEqual(ladder(0))
      expect(ladder(2)).toEqual(ladder(1))

      let prev = -1
      for (let i = 0; i <= 20; i++) {
        const ink = ladder(i / 20)
        expectValidRgb(ink)
        const lum = luminance(ink)
        expect(lum).toBeGreaterThanOrEqual(prev - 1e-12)
        prev = lum
      }
      expect(luminance(ladder(1))).toBeGreaterThan(luminance(ladder(0)))
    }
  })

  it('keeps warm colors redder relative to blue than cool colors at matching lightness', () => {
    for (const t of [0.1, 0.35, 0.6, 0.85]) {
      const w = warm(t)
      const c = cool(t)
      expect(w[0] - w[2]).toBeGreaterThan(c[0] - c[2])
    }
  })

  it('blends cool into warm across [0.15, 0.85] and keeps all channels in [0, 1]', () => {
    for (const light of [-0.5, 0, 0.35, 0.7, 1, 1.5]) {
      expectRgbClose(pigment(light, 0), cool(light))
      expectRgbClose(pigment(light, 0.15), cool(light))
      expectRgbClose(pigment(light, 0.85), warm(light))
      expectRgbClose(pigment(light, 1.4), warm(light))
      expectRgbClose(pigment(light, 0.5), mixInk(cool(light), warm(light), 0.5))

      for (const warmth of [-1, 0.15, 0.3, 0.5, 0.7, 0.85, 2]) {
        const ink = pigment(light, warmth)
        expectValidRgb(ink)
        const c = cool(light)
        const w = warm(light)
        for (let ch = 0; ch < 3; ch++) {
          expect(ink[ch]).toBeGreaterThanOrEqual(Math.min(c[ch], w[ch]) - 1e-12)
          expect(ink[ch]).toBeLessThanOrEqual(Math.max(c[ch], w[ch]) + 1e-12)
        }
      }
    }
  })
})
