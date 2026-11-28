import { localPictureOf } from '../art/pictures_local'
import { paintedTitle, parts, vignette, type Parts } from './article_shared'
import { banks, courseOf, courseRound, grown, meets, noteInk, of, PAPER, pencil, still, tide, toneOf, wander, winding, writtenIn, type Compose, type Page } from './compose_shared'
import { lettersOf } from './letters'
import { Kind, type Rect, type Wash } from './painter'
import { DETAIL, fitted, groundOf, laid, plateFor, WHOLE } from './picture_core'
import { clamp, four, pigment, smooth, type Random } from './pigments'

const framed = (rect: Rect, by: number, random: Random): Wash[] => {
  const past = 16
  const { x, y, w, h } = grown(rect, by)
  return [
    pencil({ x: x - past, y: y - 1, w: w + past * 2, h: 3 }, random),
    pencil({ x: x - past, y: y + h - 1, w: w + past * 2, h: 3 }, random),
    pencil({ x: x - 1, y: y - past, w: 3, h: h + past * 2 }, random),
    pencil({ x: x + w - 1, y: y - past, w: 3, h: h + past * 2 }, random),
  ]
}

/** Drops that flew off the brush, where nothing is written. */
function flown(round: Rect, count: number, key: string, taken: Rect[], random: Random): Wash[] {
  const tone = toneOf(key)
  return Array.from({ length: count }, (): Wash | undefined => {
    const s = 3 + 15 * random() ** 3
    const spot = { x: round.x + round.w * random(), y: round.y + round.h * random(), w: s, h: s * (0.8 + 0.4 * random()) }
    if (taken.some((box) => meets(grown(spot, 8), box))) return undefined
    const warmth = tone.warmth + 0.8 * (random() - 0.5)
    return { ...spot, kind: Kind.Puddle, ink: pigment(0.1 + 0.4 * random(), warmth), ink2: pigment(0.5, warmth), density: 0.85, seed: four(random), extra: [2, 0.9, 0, 0], delay: 900 + 900 * random(), lasts: 420, grow: 0, still: true }
  }).filter((wash) => wash !== undefined)
}

/** The first letter of what is written, large, on three squares. */
function initial({ boxes, key, cutter, random }: Parts, page: Page): Wash[] {
  const box = of(boxes, 'initial')[0]
  if (!box) return []
  const [ink, ink2] = noteInk(key)
  const tone = toneOf(key)
  const from = page.shell.getBoundingClientRect()
  const letter = lettersOf(box.element, from.left, from.top, cutter)
  const s = box.w
  return [
    ...groundOf({ x: box.x - s * 0.04, y: box.y, w: s * 0.98, h: box.h * 0.98 }, (u, v) => [0.86 - 0.1 * v, tone.warmth + 0.5 * (u - 0.5)], s / 3, random, 0.2),
    ...(letter?.letters.map((one) => ({ x: one.x, y: one.y, w: one.w, h: one.h, kind: Kind.Letter, ink, ink2, density: 1.15, seed: four(random), extra: one.uv, field: letter.field, from: [0.3, 0.2] as [number, number], delay: 400, lasts: 1300, grow: 0 })) ?? []),
  ]
}

// Book: a plate over the title, a painted initial, and a vignette over every heading.
export const book: Compose = (page) => {
  const all = parts(page)
  const { key, picture, title, headings, cutter, random, boxes } = all
  const washes: Wash[] = []
  if (picture) washes.push(...framed(picture, 10, random), ...plateFor(picture, localPictureOf(key), cutter, random))
  if (title) washes.push(...paintedTitle(title, page, cutter, random, 700))
  washes.push(...initial(all, page))
  headings.forEach((heading, i) => {
    const side = all.narrow ? 92 : 116
    washes.push(...vignette({ x: heading.x + heading.w / 2 - side / 2, y: heading.y + (all.narrow ? 10 : 22), w: side, h: side }, key, i, cutter, random))
  })
  const tail = of(boxes, 'tail')[0]
  if (tail) washes.push(...vignette(tail, key, headings.length, cutter, random))
  for (const rule of of(boxes, 'rule')) washes.push(pencil({ x: rule.x, y: rule.y, w: rule.w, h: 3 }, random))
  return { washes, paper: PAPER, mask: cutter.sheet() }
}

// Around: the title from edge to edge, and pieces of the painting in both margins all the way down.
export const around: Compose = (page) => {
  const all = parts(page)
  const { key, picture, title, prose, headings, blocks, cutter, random, narrow, boxes } = all
  const drawing = localPictureOf(key)
  const washes: Wash[] = []
  if (title) washes.push(...paintedTitle(title, page, cutter, random))
  if (picture) washes.push(...plateFor(picture, drawing, cutter, random))
  const taken = [...of(boxes, 'title', 'name', 'nav', 'quiet'), ...blocks]
  if (title) washes.push(...flown(grown(title, 60), narrow ? 8 : 22, key, taken, random))
  if (prose && !narrow) {
    const foot = prose.y + prose.h
    const down = (x0: number, x1: number, top: number, least: number, most: number, gap: number, turn: number) => {
      const room = x1 - x0
      if (room < 70) return
      let i = turn
      for (let y = top; y < foot - least; i++) {
        const side = Math.min(room, least + (most - least) * random())
        const x = x0 + (room - side) * random()
        if (y + side > foot + 60) break
        washes.push(...(i % 3 === 2 ? laid(drawing.details[i % drawing.details.length], DETAIL, x, y, side / DETAIL.across, cutter, random, 200) : vignette({ x, y, w: side, h: side }, key, i, cutter, random)))
        washes.push(...flown({ x: x - 50, y: y - 50, w: side + 100, h: side + 100 }, 6, key, taken, random))
        // small ones that came along with it
        for (let n = 0; n < (room > 260 ? 3 : 1); n++) {
          const s = 30 + Math.min(54, room * 0.16) * random()
          washes.push(...laid(drawing.details[(i + 1 + n) % drawing.details.length], DETAIL, x0 + (room - s) * random(), y + side + 16 + (gap - s - 20) * random(), s / DETAIL.across, cutter, random, 400))
        }
        y += side + gap * (0.8 + 0.4 * random())
      }
    }
    down(prose.x + prose.w + 64, page.width - 30, (picture ? picture.y + picture.h : prose.y) + 120, 200, 360, 230, 0)
    down(28, prose.x - 44, prose.y + 260, 110, 170, 420, 1)
  }
  if (narrow)
    headings.forEach((heading, i) => {
      washes.push(...vignette({ x: heading.x + heading.w - 118, y: heading.y + 12, w: 118, h: 118 }, key, i, cutter, random))
    })
  return { washes, paper: PAPER, mask: cutter.sheet() }
}

// River: the banks in the color of the piece, its painting in the mouth, and details for islands.
export const river: Compose = (page) => {
  still(page.shell)
  let all = parts(page)
  const { width, height, shell } = page
  const tone = toneOf(all.key)
  let course
  if (all.narrow) course = courseRound([...writtenIn(all.boxes, shell), ...(all.picture ? [all.picture] : [])], width, height)
  else {
    const stream = of(all.boxes, 'stream')[0]
    const half = (stream ? stream.w / 2 : 360) + 46 + 14 * tide()
    const winds = clamp((width / 2 - half) * 0.42, 10, 44)
    const mouth = Math.max(0, width * 0.6 - half)
    const middle = (y: number) => width / 2 + winds * winding(y)
    wander(shell, middle, width)
    all = parts(page)
    const deep = (all.title ? all.title.y : 500) - 60
    course = courseOf(height, (y) => [middle(y), half + mouth * (1 - smooth(70, deep + 280, y))])
  }
  const { key, picture, title, headings, cutter, random } = all
  const washes = banks({ width, top: 0, foot: height + 60, course, random, tone })
  const drawing = localPictureOf(key)
  if (picture) {
    const at = fitted(picture)
    washes.push(...groundOf({ x: at.x, y: at.y, w: WHOLE.across * at.k, h: WHOLE.down * at.k }, drawing.ground, all.narrow ? 30 : 58, random, 0.5, (_, u, v) => Math.hypot((u - 0.5) / 0.52, (v - 0.5) / 0.54) > 0.78 + 0.3 * random()), ...laid(drawing.shapes, WHOLE, at.x, at.y, at.k, cutter, random, 400))
  }
  if (title) washes.push(...paintedTitle(title, page, cutter, random, 500))
  headings.forEach((heading, i) => {
    const side = all.narrow ? 100 : 124
    washes.push(...laid(drawing.details[i % drawing.details.length], DETAIL, heading.x + heading.w / 2 - side / 2, heading.y + (all.narrow ? 14 : 20), side / DETAIL.across, cutter, random, 200))
  })
  return { washes, paper: PAPER, course, mask: cutter.sheet() }
}
