// Pitches are degrees of a scale about a center that is not the root, and the voices of a note are
// found by geometry about it: the same voicing the score is played in (looks/player.ts).

import { pitchOf, voicesOf } from '../looks/player'

export const CENTERS = [62, 67, 60, 65, 58]

export const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12)

/** A pigment is a degree: dark and cold is low, light and warm is high. */
export const degreeOf = (light: number, warmth: number) => Math.round((light * 0.62 + warmth * 0.38) * 14) - 6

export const noteOf = (center: number, degree: number) => hertz(pitchOf(center, degree))

/** The slow chord of a page: a note and the voices that go with it, close and low. */
export function chordOf(center: number, distance: number) {
  return voicesOf(distance).map((degree) => {
    let pitch = pitchOf(center, degree)
    while (pitch > center + 5) pitch -= 12
    return hertz(pitch)
  })
}
