import { describe, expect, it } from 'vitest'
import { pictureOf, type Picture, type Pigment, type Shape } from './pictures'
import { localPictureOf } from './pictures_local'
import { found } from './pictures_shared'

const LOCAL_CURATED_SLUGS = [
  'automatically-add-tokens-to-active-record-models',
  'building-software-we-love',
  'capturing-flow',
  'enthusiasm',
  'filtering-noise-with-supercollider',
  'finding-freedom-in-structure',
  'grounding-ideas-in-writing',
  'how-ai-reflects-my-brain',
  'i-wrote-a-gem-it-runs-instance-methods-in-a-job',
  'silencing-your-inner-critic',
  'systems-structure-and-creative-freedom',
  'the-importance-of-team-alignment-in-teams',
  'the-joy-of-micro-improvement',
  'tool-tailor',
  'unlocking-ideas',
  'whispers-of-silece-ep',
] as const

const EXTERNAL_CURATED_SLUGS = [
  'every-how-i-polish-software-that-agents-built',
  'every-compound-engineering-gets-an-upgrade',
  'every-the-folder-is-the-agent',
  'every-i-stopped-reading-code-my-code-reviews-got-better',
  'every-compound-engineering',
  'every-vibe-check-opus-4-5',
  'every-teach-your-ai-to-think-like-a-senior-engineer',
  'every-stop-coding-and-start-planning',
  'every-vibe-check-claude-haiku-4-5',
  'every-my-ai-had-already-fixed-the-code-before-i-saw-it',
  'every-how-i-use-claude-code-to-ship-like-a-team-of-five',
  'every-cora-is-out-of-beta',
  'every-how-i-10x-my-engineering-with-ai',
] as const

const SVG_PATH_PATTERN = /^M[MLHVCSQTAZmlhvcsqtaz0-9.,\s+-]+$/
const SAMPLE_POINTS = [0, 0.25, 0.5, 0.75, 1]

function expectPigment(pigment: Pigment) {
  expect(pigment).toHaveLength(2)
  const [light, warmth] = pigment
  expect(Number.isFinite(light)).toBe(true)
  expect(Number.isFinite(warmth)).toBe(true)
  expect(light).toBeGreaterThanOrEqual(0)
  expect(light).toBeLessThanOrEqual(1)
  expect(warmth).toBeGreaterThanOrEqual(0)
  expect(warmth).toBeLessThanOrEqual(1)
}

function expectGround(ground: Picture['ground']) {
  expect(ground).toBeTypeOf('function')
  for (const u of SAMPLE_POINTS) {
    for (const v of SAMPLE_POINTS) {
      const value = ground(u, v)
      expect(value).toHaveLength(2)
      const [light, warmth] = value
      expect(Number.isFinite(light)).toBe(true)
      expect(Number.isFinite(warmth)).toBe(true)
      expect(light).toBeGreaterThanOrEqual(0)
      expect(light).toBeLessThanOrEqual(1)
    }
  }
}

function expectValidShape(shape: Shape) {
  expect(shape.d).toMatch(SVG_PATH_PATTERN)
  if (shape.brush === undefined) {
    expect(shape.d).toMatch(/[Zz]$/)
  } else {
    expect(Number.isFinite(shape.brush)).toBe(true)
    expect(shape.brush).toBeGreaterThan(0)
  }

  expectPigment(shape.ink)
  if (shape.to !== undefined) expectPigment(shape.to)

  if (shape.density !== undefined) {
    expect(Number.isFinite(shape.density)).toBe(true)
    expect(shape.density).toBeGreaterThan(0)
  }
  if (shape.bare !== undefined) {
    expect(typeof shape.bare).toBe('boolean')
  }
}

function expectValidPicture(picture: Picture, detailCount?: number) {
  expectGround(picture.ground)
  expect(picture.shapes.length).toBeGreaterThan(0)
  for (const shape of picture.shapes) expectValidShape(shape)

  if (detailCount !== undefined) {
    expect(picture.details).toHaveLength(detailCount)
  } else {
    expect(picture.details.length).toBeGreaterThan(0)
  }
  for (const detail of picture.details) {
    expect(detail.length).toBeGreaterThan(0)
    for (const shape of detail) expectValidShape(shape)
  }
}

function sampleGround(ground: Picture['ground']) {
  return SAMPLE_POINTS.flatMap((u) => SAMPLE_POINTS.map((v) => ground(u, v)))
}

describe('pictureOf', () => {
  it.each(LOCAL_CURATED_SLUGS)('returns a valid curated picture with 4 details for local post %s', (slug) => {
    expectValidPicture(pictureOf(slug), 4)
  })

  it.each(EXTERNAL_CURATED_SLUGS)('returns a valid curated picture for external post %s', (slug) => {
    expectValidPicture(pictureOf(slug))
  })

  it('returns fresh, structurally equal picture objects on repeated calls', () => {
    const first = pictureOf('capturing-flow')
    const second = pictureOf('capturing-flow')

    expect(first).not.toBe(second)
    expect(first.shapes).not.toBe(second.shapes)
    expect(first.shapes).toEqual(second.shapes)
    expect(first.details).toEqual(second.details)
    expect(sampleGround(first.ground)).toEqual(sampleGround(second.ground))
  })

  it('marks bare ground cutouts on night-sky curated pictures', () => {
    expect(pictureOf('silencing-your-inner-critic').shapes.some((shape) => shape.bare)).toBe(true)
    expect(pictureOf('whispers-of-silece-ep').shapes.some((shape) => shape.bare)).toBe(true)
  })

  it('produces distinct compositions across curated slugs', () => {
    const signatures = new Set(
      [...LOCAL_CURATED_SLUGS, ...EXTERNAL_CURATED_SLUGS].map((slug) =>
        pictureOf(slug).shapes.map((shape) => shape.d).join('|'),
      ),
    )

    expect(signatures.size).toBe(LOCAL_CURATED_SLUGS.length + EXTERNAL_CURATED_SLUGS.length)
  })

  it('falls back deterministically for unknown slugs with 4 details and valid shapes', () => {
    const unknownSlugs = [
      'unlisted-essay',
      'a-future-note-on-craft',
      'another-draft-2026',
      'short',
      '',
      'slug-with-unicode-é-and-123',
      'yet-another-unmapped-article',
      'autumn-sketchbook',
    ]

    for (const slug of unknownSlugs) {
      const first = pictureOf(slug)
      const second = pictureOf(slug)

      expect(first.shapes).toEqual(second.shapes)
      expect(first.details).toEqual(second.details)
      expect(sampleGround(first.ground)).toEqual(sampleGround(second.ground))
      expectValidPicture(first, 4)
    }

    const fallbackSignatures = new Set(
      unknownSlugs.map((slug) => pictureOf(slug).shapes.map((shape) => shape.d).join('|')),
    )
    expect(fallbackSignatures.size).toBe(unknownSlugs.length)
  })
})

describe('localPictureOf', () => {
  it.each(LOCAL_CURATED_SLUGS)('matches pictureOf for local curated post %s', (slug) => {
    const local = localPictureOf(slug)
    const full = pictureOf(slug)

    expectValidPicture(local, 4)
    expect(local.shapes).toEqual(full.shapes)
    expect(local.details).toEqual(full.details)
    expect(sampleGround(local.ground)).toEqual(sampleGround(full.ground))
  })

  it.each(EXTERNAL_CURATED_SLUGS)('excludes external curated post %s and returns deterministic fallback', (slug) => {
    const first = localPictureOf(slug)
    const second = localPictureOf(slug)
    const fallback = found(slug)
    const external = pictureOf(slug)

    expectGround(first.ground)
    for (const shape of first.shapes) expectValidShape(shape)
    expect(first.details).toHaveLength(4)
    for (const detail of first.details) {
      expect(detail.length).toBeGreaterThan(0)
      for (const shape of detail) expectValidShape(shape)
    }
    expect(first.shapes).toEqual(second.shapes)
    expect(first.details).toEqual(second.details)
    expect(sampleGround(first.ground)).toEqual(sampleGround(second.ground))
    expect(first.shapes).toEqual(fallback.shapes)
    expect(first.details).toEqual(fallback.details)
    expect(sampleGround(first.ground)).toEqual(sampleGround(fallback.ground))
    expect(first.shapes).not.toEqual(external.shapes)
  })

  it('falls back deterministically for unknown slugs matching pictureOf', () => {
    const unknownSlugs = ['unlisted-essay', 'another-draft-2026', '', 'slug-with-unicode-é-and-123']

    for (const slug of unknownSlugs) {
      const local = localPictureOf(slug)
      const full = pictureOf(slug)

      expectValidPicture(local, 4)
      expect(local.shapes).toEqual(full.shapes)
      expect(local.details).toEqual(full.details)
      expect(sampleGround(local.ground)).toEqual(sampleGround(full.ground))
    }
  })
})
