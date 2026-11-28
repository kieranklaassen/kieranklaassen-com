import { localPictureOf } from '../art/pictures_local'
import { letterInk, NARROW, of, toneOf, type Page, type PaintBox } from './compose_shared'
import { lettersOf } from './letters'
import { Cutter } from './mask'
import { Kind, type Rect, type Wash } from './painter'
import { DETAIL, fitted, groundOf, laid } from './picture_core'
import { four, hashOf, pigment, seeded, type Random } from './pigments'

/** A heading painted letter by letter, in the colors of its piece. */
export function paintedTitle(box: PaintBox, page: Page, cutter: Cutter, random: Random, delay = 0): Wash[] {
  const from = page.shell.getBoundingClientRect()
  const found = lettersOf(box.element, from.left, from.top, cutter)
  if (!found) return []
  const tone = toneOf(box.key)
  const size = parseFloat(getComputedStyle(box.element).fontSize)
  const step = Math.min(60, 1400 / found.letters.length)
  return found.letters.map((letter, i) => {
    const [a] = letterInk(i, found.letters.length, tone.warmth)
    const at = i / Math.max(1, found.letters.length - 1)
    const warmth = tone.warmth + 0.55 * Math.sin(at * 5.2 + tone.light * 9)
    const light = 0.1 + 0.18 * (0.5 + 0.5 * Math.sin(i * 2.1 + tone.light * 20))
    return {
      x: letter.x, y: letter.y, w: letter.w, h: letter.h,
      kind: Kind.Letter,
      ink: pigment(light, warmth),
      ink2: i % 3 ? pigment(light + 0.16, warmth + 0.4 * Math.cos(i * 1.9)) : a,
      density: size > 90 ? 1.15 : 1.4,
      seed: four(random),
      extra: letter.uv,
      field: found.field,
      index: i,
      from: [0.2 + 0.6 * random(), random()],
      delay: delay + i * step,
      lasts: 1300,
      grow: 0,
    } satisfies Wash
  })
}

const areaOf = (element: Element, shell: HTMLElement): Rect => {
  const from = shell.getBoundingClientRect()
  const box = element.getBoundingClientRect()
  return { x: box.left - from.left, y: box.top - from.top, w: box.width, h: box.height }
}

/** One detail of a picture, on a few squares of its ground. */
export function vignette(rect: Rect, key: string, index: number, cutter: Cutter, random: Random): Wash[] {
  const picture = localPictureOf(key)
  const at = fitted(rect, DETAIL.across, DETAIL.down)
  const side = DETAIL.across * at.k
  const inset = side * 0.06
  return [
    ...groundOf({ x: at.x + inset, y: at.y + inset, w: side - inset * 2, h: side - inset * 2 }, picture.ground, side / 3.4, random, 0.34),
    ...laid(picture.details[index % picture.details.length], DETAIL, at.x, at.y, at.k, cutter, random, 260),
  ]
}

export interface Parts {
  key: string
  narrow: boolean
  boxes: PaintBox[]
  picture?: PaintBox
  title?: PaintBox
  prose?: Rect
  headings: Rect[]
  blocks: Rect[]
  cutter: Cutter
  random: Random
}

export function parts(page: Page): Parts {
  const boxes = page.boxes()
  const title = of(boxes, 'title')[0]
  const prose = page.shell.querySelector('.wc-prose')
  const key = title?.key ?? ''
  return {
    key,
    narrow: page.width < NARROW,
    boxes,
    picture: of(boxes, 'picture')[0],
    title,
    prose: prose ? areaOf(prose, page.shell) : undefined,
    headings: [...(prose?.querySelectorAll(':scope > :is(h2, h3)') ?? [])].map((one) => areaOf(one, page.shell)),
    blocks: [...(prose?.children ?? [])].map((one) => areaOf(one, page.shell)),
    cutter: new Cutter(),
    random: seeded(hashOf(key) ^ Math.floor(page.random() * 1e9)),
  }
}
