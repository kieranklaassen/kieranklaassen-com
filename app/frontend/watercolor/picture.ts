import { pictureOf } from '../art/pictures'
import type { Cutter } from './mask'
import type { Rect, Wash } from './painter'
import { DETAIL, fitted, groundOf, laid, plateFor, runsOff, WHOLE } from './picture_core'
import type { Random } from './pigments'

export { DETAIL, fitted, groundOf, laid, plateFor, runsOff, WHOLE }

/** The whole picture of a piece. */
export function plate(box: Rect, key: string, cutter: Cutter, random: Random, small = false): Wash[] {
  return plateFor(box, pictureOf(key), cutter, random, small)
}
