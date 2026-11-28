import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Stroke } from './ink'
import { colours, keepChange, keepColours, keptInk } from './kept'

let stored: Map<string, string>

const stroke = (id: string): Stroke => ({
  id,
  pen: 'liner',
  colour: '#1f1a1d',
  points: [[1, 2, 1], [3, 4, 1]],
  at: { block: 0, starts: 'Once', w: 600, h: 80 },
})

beforeEach(() => {
  stored = new Map()
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) })
})
afterEach(() => vi.unstubAllGlobals())

describe('kept ink', () => {
  it('is read back on its own page and on no other', () => {
    keepChange('/a', { added: [stroke('1')], removed: [] })
    expect(keptInk('/a')).toEqual([stroke('1')])
    expect(keptInk('/b')).toEqual([])
  })

  it('keeps what two tabs each add, and takes away only what is named', () => {
    keepChange('/a', { added: [stroke('1')], removed: [] })
    keepChange('/a', { added: [stroke('2')], removed: [] })
    keepChange('/a', { added: [], removed: [stroke('1')] })
    expect(keptInk('/a').map(({ id }) => id)).toEqual(['2'])
  })

  it('reads nothing from what is malformed or of another version', () => {
    keepChange('/a', { added: [stroke('1')], removed: [] })
    const [[key, value]] = [...stored]
    stored.set(key, '{not json')
    expect(keptInk('/a')).toEqual([])
    stored.set(key, JSON.stringify({ ...JSON.parse(value), version: 99 }))
    expect(keptInk('/a')).toEqual([])
  })

  it.each<[string, (one: Record<string, unknown>) => void]>([
    ['an unknown pen', (one) => (one.pen = 'crayon')],
    ['a colour the pen does not hold', (one) => (one.colour = 'url(#x)')],
    ['no points', (one) => (one.points = [])],
    ['a point that is no number', (one) => (one.points = [[1, null, 1]])],
    ['no anchor', (one) => delete one.at],
    ['a broken range', (one) => ((one.at as Record<string, unknown>).words = { from: 1 })],
  ])('drops a stroke with %s and keeps the rest', (_, spoil) => {
    keepChange('/a', { added: [stroke('1'), stroke('2')], removed: [] })
    const [[key, value]] = [...stored]
    const all = JSON.parse(value)
    spoil(all.strokes[0])
    stored.set(key, JSON.stringify(all))
    expect(keptInk('/a').map(({ id }) => id)).toEqual(['2'])
  })

  it('goes without a store that throws', () => {
    const refuse = () => {
      throw new Error('no')
    }
    vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse })
    expect(keptInk('/a')).toEqual([])
    expect(() => keepChange('/a', { added: [stroke('1')], removed: [] })).not.toThrow()
  })

  it('remembers the colour of each pen, if the pen holds it', () => {
    keepColours({ ...colours(), marker: '#2f6473' })
    expect(colours().marker).toBe('#2f6473')
    keepColours({ ...colours(), marker: '#bada55' })
    expect(colours().marker).not.toBe('#bada55')
  })
})
