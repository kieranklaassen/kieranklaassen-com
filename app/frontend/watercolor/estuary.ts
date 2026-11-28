import {
  banks,
  courseOf,
  courseRound,
  NARROW,
  of,
  PAPER,
  still,
  tide,
  toneOf,
  wander,
  winding,
  writtenIn,
  type Compose,
} from './compose_shared'
import type { Course } from './painter'
import { clamp } from './pigments'

// Estuary: sandbanks seen from the air, and a creek of bare paper that the writing runs down.
export const estuary: Compose = ({ width, height, boxes: measure, shell, random }) => {
  still(shell)
  let boxes = measure()
  const sheet = of(boxes, 'sheet')[0]
  const tone = sheet && toneOf(sheet.key)
  let course: Course
  if (width < NARROW) course = courseRound(writtenIn(boxes, shell), width, height)
  else {
    const stream = of(boxes, 'stream')[0]
    const half = (stream ? stream.w / 2 : 360) + 46 + 14 * tide()
    const winds = clamp((width / 2 - half) * 0.42, 10, sheet ? 44 : 96)
    const mouth = Math.max(0, width * 0.36 - half)
    const middle = (y: number) => width / 2 + winds * winding(y)
    wander(shell, middle, width)
    boxes = measure()
    course = courseOf(height, (y) => [middle(y), half + mouth * Math.exp(-(((y - 300) / 250) ** 2))])
  }
  return { washes: banks({ width, top: 0, foot: height + 60, course, random, tone }), paper: PAPER, course }
}
