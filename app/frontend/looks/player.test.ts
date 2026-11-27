import { describe, expect, it } from 'vitest'
import { distanceOf, pitchOf, voicesOf } from './player'

describe('the voices of a stroke', () => {
  it('mirrors about the middle of the staff', () => {
    for (let lane = 0; lane < 8; lane++) expect(distanceOf(7 - lane) + distanceOf(lane)).toBe(0)
  })

  it('finds the six voices in degrees', () => {
    expect(voicesOf(5)).toEqual([5, -5, 3, -3, -4, 0])
    expect(voicesOf(-5)).toEqual([-5, 5, -3, 3, 4, 0])
  })

  it('stays in the scale, about its second', () => {
    expect(pitchOf(62, 0)).toBe(62) // D in C major
    expect([1, 2, 3, 7].map((degrees) => pitchOf(62, degrees))).toEqual([64, 65, 67, 74])
    expect([-1, -2, -7].map((degrees) => pitchOf(62, degrees))).toEqual([60, 59, 50])
    const inC = new Set([0, 2, 4, 5, 7, 9, 11])
    for (let degrees = -14; degrees <= 14; degrees++) expect(inC.has(pitchOf(62, degrees) % 12)).toBe(true)
  })
})
