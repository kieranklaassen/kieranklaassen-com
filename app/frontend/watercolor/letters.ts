import type { Cut, Cutter } from './mask'

const PAD = 14
const SCALE = 0.5

export interface Letter {
  char: string
  x: number
  y: number
  w: number
  h: number
  uv: Cut['uv']
  /** For every mask pixel across the letter, the page y of its lowest painted pixel. */
  feet: { x: number; y: number }[]
}

/** Every letter of `element` where the page shows it, cut out so that a wash can be laid in each. */
export function lettersOf(element: HTMLElement, originX: number, originY: number, cutter: Cutter): { letters: Letter[]; field: number } | undefined {
  const style = getComputedStyle(element)
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const found: { char: string; box: DOMRect }[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    for (let i = 0; i < text.length; i++) {
      if (!text[i].trim()) continue
      const range = document.createRange()
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      found.push({ char: text[i], box: range.getBoundingClientRect() })
    }
  }
  if (!found.length) return undefined

  const fontSize = parseFloat(style.fontSize)
  const scale = fontSize < 70 ? 1 : SCALE
  const font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return undefined
  context.font = font
  const ascent = context.measureText('Hg').fontBoundingBoxAscent
  const height = fontSize * 1.5 + PAD * 2
  const field = fontSize * 0.09
  const letters = found.map(({ char, box }) => {
    const cut = cutter.cut(context.measureText(char).width + fontSize * 0.12 + PAD * 2, height, scale, field, (on) => {
      on.font = font
      on.textBaseline = 'alphabetic'
      on.fillText(char, PAD, PAD + fontSize * 1.1)
    })
    const x = box.left - originX - PAD
    const y = box.top - originY + ascent - fontSize * 1.1 - PAD
    const feet: Letter['feet'] = []
    for (let px = 0; px < cut.w; px++)
      for (let py = cut.h - 1; py >= 0; py--)
        if (cut.alpha[py * cut.w + px] > 127) {
          feet.push({ x: x + px / scale, y: y + py / scale })
          break
        }
    return { char, x, y, w: cut.w / scale, h: cut.h / scale, uv: cut.uv, feet }
  })
  return { letters, field }
}
