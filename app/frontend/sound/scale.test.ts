import { describe, expect, it } from 'vitest'
import { chordOf, degreeOf, hertz } from './scale'
import { placeOf } from './place'

describe('the sound of a page', () => {
  it('is low where it is dark and cold, and high where it is light and warm', () => {
    expect(degreeOf(0.1, 0.1)).toBeLessThan(degreeOf(0.9, 0.9))
  })

  it('has six voices to a chord, none of them high', () => {
    const chord = chordOf(62, 5)
    expect(chord).toHaveLength(6)
    expect(Math.max(...chord)).toBeLessThanOrEqual(hertz(67))
  })

  it('is the same every time a page is opened', () => {
    const rooms = { art: 'book', body: 'article' } as const
    expect(placeOf(rooms, '/2024/01/01/a-thought/?art=book')).toEqual(placeOf(rooms, '/2024/01/01/a-thought/'))
  })

  it('is the sea on a river, whatever is written there', () => {
    expect(placeOf({ art: 'river', body: 'article' }, '/code/a-gem/').sky).toBe('sea')
    expect(placeOf({ art: 'book', body: 'article' }, '/code/a-gem/').sky).toBe('rain')
  })
})
