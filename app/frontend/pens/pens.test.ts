import { describe, expect, it } from 'vitest'
import { holds, isPen, PEN_NAMES, PENS } from './pens'

describe('PENS and PEN_NAMES', () => {
  it('lists all five drawing pens in tray order without the eraser', () => {
    expect(PEN_NAMES).toEqual(['pencil', 'liner', 'marker', 'brush', 'highlighter'])
    expect(PEN_NAMES).toEqual(Object.keys(PENS))
    expect(PEN_NAMES).not.toContain('eraser')
  })

  it('defines valid dimensions, opacity, variation, and unique hex colours for every pen', () => {
    for (const name of PEN_NAMES) {
      const pen = PENS[name]
      expect(pen.title.length).toBeGreaterThan(0)
      expect(pen.width).toBeGreaterThan(0)
      expect(pen.opacity).toBeGreaterThan(0)
      expect(pen.opacity).toBeLessThanOrEqual(1)
      expect(pen.varies).toBeGreaterThanOrEqual(0)
      expect(pen.varies).toBeLessThanOrEqual(1)
      expect(pen.colours.length).toBeGreaterThan(0)

      const hexes = new Set<string>()
      for (const [label, colour] of pen.colours) {
        expect(label.length).toBeGreaterThan(0)
        expect(colour).toMatch(/^#[0-9a-f]{6}$/)
        hexes.add(colour)
      }
      expect(hexes.size).toBe(pen.colours.length)
    }
  })

  it('assigns grain only to the pencil and chisel only to the highlighter', () => {
    expect(PEN_NAMES.filter((name) => PENS[name].grain)).toEqual(['pencil'])
    expect(PEN_NAMES.filter((name) => PENS[name].chisel)).toEqual(['highlighter'])
    expect(PENS.brush.varies).toBe(1)
    expect(PENS.pencil.varies).toBeGreaterThan(0)
    expect(PENS.pencil.varies).toBeLessThan(1)
    expect(PENS.liner.varies).toBe(0)
    expect(PENS.marker.varies).toBe(0)
    expect(PENS.highlighter.varies).toBe(0)
  })
})

describe('isPen', () => {
  it.each(PEN_NAMES)('accepts %s', (name) => {
    expect(isPen(name)).toBe(true)
  })

  it.each(['eraser', '', 'chalk', 'Pencil', 'MARKER', 'pen'])('rejects non-pen string %j', (name) => {
    expect(isPen(name)).toBe(false)
  })

  it.each(['toString', 'valueOf', 'constructor', 'hasOwnProperty', '__proto__'])(
    'rejects Object.prototype key %s via Object.hasOwn',
    (key) => {
      expect(isPen(key)).toBe(false)
    },
  )

  it.each([null, undefined, 0, 1, true, false, {}, [], Symbol('pencil')])('rejects non-string value %o', (value) => {
    expect(isPen(value)).toBe(false)
  })
})

describe('holds', () => {
  it('returns true for every ink colour held by each pen', () => {
    for (const pen of PEN_NAMES) {
      for (const [, colour] of PENS[pen].colours) {
        expect(holds(pen, colour)).toBe(true)
      }
    }
  })

  it('rejects colours belonging only to other pens, colour labels, mismatched case, and non-strings', () => {
    expect(holds('pencil', '#1f1a1d')).toBe(false)
    expect(holds('pencil', '#ffe45c')).toBe(false)
    expect(holds('highlighter', '#b4473a')).toBe(false)
    expect(holds('liner', '#74446f')).toBe(false)
    expect(holds('marker', '#3f7a4d')).toBe(false)

    expect(holds('liner', 'Black')).toBe(false)
    expect(holds('pencil', 'Graphite')).toBe(false)
    expect(holds('liner', '#B4473A')).toBe(false)
    expect(holds('brush', '')).toBe(false)
    expect(holds('brush', null)).toBe(false)
    expect(holds('brush', undefined)).toBe(false)
    expect(holds('brush', 123)).toBe(false)
    expect(holds('brush', {})).toBe(false)
  })
})
