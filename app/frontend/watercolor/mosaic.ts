import { of, PAPER, type Compose } from './compose_shared'
import { sheetWashes } from './compose_sheets'
import { Kind, type Wash } from './painter'
import { clamp, four, pigment } from './pigments'

// Mosaic: the net again, and the name is in it. A square inside a letter is deep, one outside is light.
export const mosaic: Compose = ({ width, boxes: measure, shell, random }) => {
  const boxes = measure()
  const washes: Wash[] = [...sheetWashes(boxes, random)]
  const name = of(boxes, 'name')[0]
  const letters = name && linesOf(name.element, shell, width < 700 ? 7 : 9)
  if (!name || !letters) return { washes, paper: PAPER }
  if (width < 700 && name.element.closest('[data-small]')) return { washes, paper: PAPER } // too small for squares
  const turn = random() * 6
  const top = 10
  const small = width < 700
  const edge = small ? 6 : 12
  const bottom = name.y + name.h + letters.row * (width < 700 ? 2.4 : 2.1)
  for (let at = letters.top % letters.row - letters.row; at < bottom; at += letters.row) {
    const y = at + (random() - 0.5) * 1.5
    if (y < top - letters.row * 0.4) continue
    // the stretches of this row that are in a letter, and those between
    const stops = [edge, ...letters.stretches(y, letters.row).flat().filter((x) => x > edge && x < width - edge), width - edge]
    for (let i = 0; i + 1 < stops.length; i++) {
      const inside = i % 2 === 1
      let x = stops[i]
      while (x < stops[i + 1] - 3) {
        let w = letters.row * (inside ? (small ? 2.6 + 1.2 * random() : 0.9 + 1.5 * random()) : (small ? 1.4 : 0.55) + (small ? 3 : 1.9) * random())
        if (stops[i + 1] - x - w < letters.row * 0.5) w = stops[i + 1] - x
        const cx = (x + w / 2) / width
        const cy = (y - top) / (bottom - top)
        const warmth = 0.5 + 0.46 * Math.sin(cx * 5.2 - cy * 2.6 + turn) + (random() - 0.5) * 0.7
        const light = inside ? clamp(0.02 + 0.36 * random() * random() + 0.1 * Math.sin(cx * 9 + turn)) : clamp(0.97 - 0.34 * random() ** 2.4 - 0.1 * Math.abs(cx - 0.5))
        const gap = small ? 0.9 : 1.6
        washes.push({
          x: x + gap, y: y + gap, w: w - gap * 2, h: letters.row - gap * 2,
          kind: Kind.Square,
          ink: pigment(light, warmth),
          ink2: pigment(clamp(light + 0.08), warmth + 0.5 * (random() - 0.5)),
          density: inside ? 1.0 + 0.35 * random() : 0.42 + 0.4 * random(),
          seed: four(random),
          extra: [0, w > 30 ? 1 : 0, 0, 0],
          from: [0.5, 0.5],
          delay: inside ? 900 + 900 * random() : 700 * random() + 300 * cx,
          lasts: 900,
          grow: 0,
        })
        x += w
      }
    }
  }
  return { washes, paper: PAPER }
}

/** The name as rows: for each, the stretches from x to x that lie in a letter. */
function linesOf(element: HTMLElement, shell: HTMLElement, rows: number) {
  const style = getComputedStyle(element)
  const size = parseFloat(style.fontSize)
  const from = shell.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  const box = element.getBoundingClientRect()
  const left = Math.floor(box.left - from.left - 20)
  const start = Math.floor(box.top - from.top - size * 0.3)
  canvas.width = Math.ceil(shell.clientWidth - left)
  canvas.height = Math.ceil(box.height + size * 0.6)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return undefined
  context.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`
  const ascent = context.measureText('Hg').fontBoundingBoxAscent
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let first = Infinity
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    for (let i = 0; i < text.length; i++) {
      if (!text[i].trim()) continue
      const range = document.createRange()
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const at = range.getBoundingClientRect()
      const base = at.top - from.top + ascent
      first = Math.min(first, base - size * 0.727)
      context.fillText(style.textTransform === 'uppercase' ? text[i].toUpperCase() : text[i], at.left - from.left - left, base - start)
    }
  }
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  // whole rows to a capital, so that a letter's bars fall on them
  const row = (size * 0.727) / rows
  const stretches = (y: number, h: number): [number, number][] => {
    const y0 = Math.round(y - start)
    const y1 = Math.round(y + h - start)
    if (y1 <= 0 || y0 >= canvas.height) return []
    const found: [number, number][] = []
    let open = -1
    for (let x = 0; x <= canvas.width; x++) {
      let sum = 0
      let n = 0
      if (x < canvas.width)
        for (let yy = Math.max(0, y0); yy < Math.min(canvas.height, y1); yy += 2) {
          sum += pixels[(yy * canvas.width + x) * 4 + 3]
          n++
        }
      const on = n > 0 && sum / n > 120
      if (on && open < 0) open = x
      if (!on && open >= 0) {
        if (x - open > 4) found.push([open + left, x + left])
        open = -1
      }
    }
    return found
  }
  return { row, top: first, stretches }
}
