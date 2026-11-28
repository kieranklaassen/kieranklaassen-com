import { round, type Anchor, type Point, type Stroke } from './ink'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

const BLOCKS = 'h1, h2, h3, h4, p, li, pre, blockquote, figure, img, iframe, time, .wc-picture'
const NOT_BLOCKS = '.wc-pens, .wc-sound, .wc-chooser, .painted-sheet'
const STARTS = 48

/** A stroke this much flatter than its line of text runs along it. */
const FLAT = 0.9
const LONG = 1.5
/** How far below its letters a line of text still reaches, as a share of their height: an underline is there. */
const UNDER = 0.35

const startOf = (block: HTMLElement) => (block.textContent ?? '').trim().slice(0, STARTS)

/** What can be drawn on, in the order of the page. */
export const blocksOf = (shell: HTMLElement) => [...shell.querySelectorAll<HTMLElement>(BLOCKS)].filter((one) => !one.closest(NOT_BLOCKS))

function boxIn(shell: HTMLElement) {
  const from = shell.getBoundingClientRect()
  return ({ left, top, width, height }: DOMRect): Box => ({ x: left - from.left, y: top - from.top, w: width, h: height })
}

function boundsOf(points: Point[]): Box {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of points) {
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  return { x: left, y: top, w: right - left, h: bottom - top }
}

function centreOf(points: Point[]) {
  const { x, y, w, h } = boundsOf(points)
  return [x + w / 2, y + h / 2]
}

const far = (box: Box, x: number, y: number) => Math.hypot(Math.max(box.x - x, 0, x - box.x - box.w), Math.max(box.y - y, 0, y - box.y - box.h))

function textsOf(block: HTMLElement) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  const texts: { node: Text; from: number }[] = []
  let from = 0
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    texts.push({ node, from })
    from += node.length
  }
  return texts
}

function rangeOf(block: HTMLElement, from: number, to: number) {
  const texts = textsOf(block)
  const start = texts.filter((one) => one.from <= from).at(-1)
  const end = texts.filter((one) => one.from < to).at(-1)
  if (!start || !end || to - end.from > end.node.length) return undefined
  const range = document.createRange()
  range.setStart(start.node, from - start.from)
  range.setEnd(end.node, to - end.from)
  return range
}

/** One box for each line that rectangles stand on. */
export function linesOf(rects: DOMRect[]): Box[] {
  const lines: Box[] = []
  for (const { left, top, right, bottom } of rects) {
    if (right <= left) continue
    const line = lines.at(-1)
    const middle = (top + bottom) / 2
    if (line && middle > line.y && middle < line.y + line.h) {
      const y = Math.min(line.y, top)
      lines[lines.length - 1] = { x: Math.min(line.x, left), y, w: Math.max(line.x + line.w, right) - Math.min(line.x, left), h: Math.max(line.y + line.h, bottom) - y }
    } else lines.push({ x: left, y: top, w: right - left, h: bottom - top })
  }
  return lines
}

/** The letters a stroke runs along, if it runs along any. */
function wordsAlong(points: Point[], block: HTMLElement, box: Box, boxOf: (rect: DOMRect) => Box): Anchor['words'] {
  const drawn = boundsOf(points)
  const middle = drawn.y + drawn.h / 2
  if (drawn.w < drawn.h * LONG) return undefined
  const range = document.createRange()
  const letters: { at: number; box: Box }[] = []
  for (const { node, from } of textsOf(block)) {
    for (let i = 0; i < node.length; i++) {
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const rect = range.getClientRects()[0]
      if (rect?.width) letters.push({ at: from + i, box: boxOf(rect) })
    }
  }
  const reaching = ({ box: { x, y, w, h } }: { box: Box }) => middle >= y && middle <= y + h * (1 + UNDER) && drawn.h <= h * FLAT && x + w / 2 > drawn.x && x + w / 2 < drawn.x + drawn.w
  // the letters of tightly set lines reach into one another
  const off = ({ box: { y, h } }: { box: Box }) => Math.abs(y + h / 2 - middle)
  const [line] = letters.filter(reaching).sort((a, b) => off(a) - off(b))
  if (!line) return undefined
  const along = letters.filter((one) => reaching(one) && Math.abs(one.box.y - line.box.y) < line.box.h / 2)
  if (along.length < 2) return undefined
  const x = Math.min(...along.map((one) => one.box.x))
  const y = Math.min(...along.map((one) => one.box.y))
  const w = Math.max(...along.map((one) => one.box.x + one.box.w)) - x
  const h = Math.max(...along.map((one) => one.box.y + one.box.h)) - y
  return { from: along[0].at, to: along[along.length - 1].at + 1, x: x - box.x, y: y - box.y, w, h }
}

const within = (points: Point[], { x, y }: Box) => points.map(([px, py, wide]): Point => [round(px - x), round(py - y), Math.round(wide * 100) / 100])

/** Ties a stroke that was drawn on the page to what it was drawn on: the smallest block that is nearest. */
export function anchor(points: Point[], shell: HTMLElement): { at: Anchor; points: Point[] } {
  const boxOf = boxIn(shell)
  const [x, y] = centreOf(points)
  const [nearest] = blocksOf(shell)
    .map((element, block) => ({ element, block, box: boxOf(element.getBoundingClientRect()) }))
    .filter(({ box }) => box.w > 0 && box.h > 0)
    .map((one) => ({ ...one, far: far(one.box, x, y) }))
    .sort((a, b) => a.far - b.far || a.box.w * a.box.h - b.box.w * b.box.h)
  if (!nearest) {
    const box = { x: 0, y: 0, w: shell.clientWidth, h: shell.scrollHeight }
    return { at: { block: -1, starts: '', w: box.w, h: box.h }, points: within(points, box) }
  }
  const { element, block, box } = nearest
  const words = wordsAlong(points, element, box, boxOf)
  return { at: { block, starts: startOf(element), w: box.w, h: box.h, ...(words && { words }) }, points: within(points, box) }
}

/** Lays points that were drawn over one box along the lines its words stand on now. */
export function cut(points: Point[], was: Box, lines: Box[]): Point[][] {
  const whole = lines.reduce((sum, line) => sum + line.w, 0)
  let from = 0
  const spans = lines.map((line) => {
    const span = { line, from }
    from += line.w
    return span
  })
  const spanAt = (along: number) => Math.max(0, spans.filter((span) => span.from <= along).length - 1)
  const scaled = points.map(([x, y, wide]): Point => [((x - was.x) / was.w) * whole, (y - was.y) / was.h, wide])
  const cuts: Point[][] = []
  const put = (span: number, [along, down, wide]: Point, anew: boolean) => {
    const { line, from: start } = spans[span]
    if (anew) cuts.push([])
    cuts[cuts.length - 1].push([line.x + along - start, line.y + down * line.h, wide])
  }
  let current = -1
  scaled.forEach((point, i) => {
    const span = spanAt(point[0])
    if (i > 0) {
      const last = scaled[i - 1]
      // every end of a line between two points is a place to lift the pen and put it down again
      while (current !== span) {
        const next = current + Math.sign(span - current)
        const end = spans[Math.max(current, next)].from
        const t = (end - last[0]) / (point[0] - last[0])
        const at: Point = [end, last[1] + (point[1] - last[1]) * t, last[2] + (point[2] - last[2]) * t]
        put(current, at, false)
        put(next, at, true)
        current = next
      }
    }
    put(span, point, i === 0)
    current = span
  })
  return cuts
}

function blockFor({ block, starts }: Anchor, blocks: HTMLElement[]) {
  const there = blocks[block]
  return there && startOf(there) === starts ? there : starts ? blocks.find((one) => startOf(one) === starts) : undefined
}

/** Where a stroke is now, in as many pieces as there are lines. Nowhere, if what it was drawn on is gone or not shown. */
export function place({ points, at }: Stroke, blocks: HTMLElement[], shell: HTMLElement): Point[][] | undefined {
  const boxOf = boxIn(shell)
  const block = at.block < 0 ? shell : blockFor(at, blocks)
  const box = block && boxOf(block.getBoundingClientRect())
  if (!block || !box?.w || !box.h) return undefined
  const range = at.words && rangeOf(block, at.words.from, at.words.to)
  if (at.words && range) {
    const lines = linesOf([...range.getClientRects()]).map(({ x, y, w, h }) => boxOf(new DOMRect(x, y, w, h)))
    if (lines.length) return cut(points, at.words, lines)
  }
  const [x, y] = centreOf(points)
  const scale = Math.min(1, box.w / at.w)
  return [points.map(([px, py, wide]): Point => [box.x + (x / at.w) * box.w + (px - x) * scale, box.y + (y / at.h) * box.h + (py - y) * scale, wide])]
}
