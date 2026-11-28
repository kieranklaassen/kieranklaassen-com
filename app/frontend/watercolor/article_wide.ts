import { localPictureOf } from '../art/pictures_local'
import { paintedTitle, parts, vignette } from './article_shared'
import { grown, meets, of, PAPER, type Compose } from './compose_shared'
import type { Wash } from './painter'
import { DETAIL, fitted, groundOf, laid, runsOff, WHOLE } from './picture_core'
import { clamp, smooth } from './pigments'

// Wide: the top of the page is the painting from edge to edge, and it lets the title have bare paper.
export const wide: Compose = (page) => {
  const all = parts(page)
  const { key, picture, title, cutter, random, narrow, boxes } = all
  const washes: Wash[] = []
  if (picture) {
    const drawing = localPictureOf(key)
    const taken = of(boxes, 'title', 'quiet', 'name', 'nav').map((box) => grown(box, narrow ? 10 : 26))
    const unit = narrow ? 38 : 70
    washes.push(
      ...groundOf({ x: -10, y: picture.y, w: page.width + 20, h: picture.h }, (u, v) => drawing.ground(narrow ? u : clamp((u - 0.36) / 0.64), v), unit, random, 0, (cell, u, v) => {
        if (taken.some((box) => meets(cell, box))) return true
        const written = narrow ? 1 : smooth(0.2, 0.5, u)
        return random() > 0.08 + 0.92 * written * (1 - 0.7 * smooth(0.86, 1, v))
      }),
    )
    // what runs off its sheet runs off the window
    const off = runsOff(drawing.shapes)
    const inside = narrow ? { ...picture, x: picture.x + 12, w: picture.w - 24 } : { x: page.width * 0.4, y: picture.y + picture.h * 0.06, w: page.width * 0.58, h: picture.h * 0.88 }
    const at = fitted(!off ? inside : narrow ? { ...picture, x: -6, w: page.width + 12 } : { ...inside, w: page.width * 0.6 + 6 })
    if (off && !narrow) at.x = page.width + 6 - WHOLE.across * at.k
    washes.push(...laid(drawing.shapes, WHOLE, at.x, at.y, at.k, cutter, random, 600, !narrow))
  }
  if (title) washes.push(...paintedTitle(title, page, cutter, random, 300))
  // the squares come loose and fall a little way down the page
  if (picture && !narrow) {
    const below = { x: 0, y: picture.y + picture.h, w: page.width, h: 380 }
    const drawing = localPictureOf(key)
    washes.push(...groundOf(below, (u) => drawing.ground(u, 1), 46, random, 0, (cell, u, v) => (all.prose && meets(grown(cell, 46), all.prose)) || random() > 0.5 * (1 - v) ** 2 * (0.2 + Math.abs(u - 0.5) * 1.6)))
  }
  // a detail hangs in the margin at every heading
  if (!narrow && all.prose)
    all.headings.forEach((heading, i) => {
      const side = Math.min(150, heading.x - 90)
      if (side > 60) washes.push(...vignette({ x: heading.x - side - 46, y: heading.y - side * 0.34, w: side, h: side }, key, i, cutter, random))
    })
  const foot = of(boxes, 'foot')[0]
  if (foot) {
    const drawing = localPictureOf(key)
    washes.push(...groundOf({ x: -10, y: foot.y, w: page.width + 20, h: foot.h }, (u) => drawing.ground(u, 1), narrow ? 34 : 56, random, 0.4, (_, __, v) => random() > 0.25 + 0.75 * v))
    const side = Math.min(foot.h * 0.94, 190)
    const count = narrow ? 2 : 4
    for (let i = 0; i < count; i++) washes.push(...laid(drawing.details[i % drawing.details.length], DETAIL, ((i + 0.5) / count) * page.width - side / 2 + (random() - 0.5) * 40, foot.y + (foot.h - side) / 2, side / DETAIL.across, cutter, random, 300))
  }
  return { washes, paper: PAPER, mask: cutter.sheet() }
}
