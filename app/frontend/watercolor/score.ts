import { of, PAPER, type Compose } from './compose_shared'
import { sheetWashes } from './compose_sheets'
import { staffWashes, swatchWash } from './compose_staff'
import { Cutter } from './mask'
import { plate } from './picture'
import { hashOf, seeded } from './pigments'

// Score: the years run from left to right and what a thought is about from low to high. A thought
// is a stroke of strong paint; what is silent is pale squares.
export const score: Compose = ({ boxes: measure, random }) => {
  const boxes = measure()
  const swatches = of(boxes, 'swatch').filter((box) => box.w > 0).map((swatch) => swatchWash(swatch, random))
  const cutter = new Cutter()
  const pictures = of(boxes, 'picture').flatMap((box) => plate(box, box.key, cutter, seeded(hashOf(box.key)), true))
  return { washes: [...swatches, ...sheetWashes(boxes, random), ...staffWashes(boxes, random), ...pictures], paper: PAPER, mask: cutter.sheet() }
}
