import { of, toneOf, type PaintBox } from './compose_shared'
import { Kind, type Rect, type Wash } from './painter'
import { clamp, four, hashOf, pigment, seeded, type Random } from './pigments'

/** Squares made of what is written: a word to a square beside an entry, a sentence to a square over an article. */
export function sheetWashes(boxes: PaintBox[], random: Random): Wash[] {
  return of(boxes, 'phrase').flatMap((band) => (band.element.dataset.of === 'article' ? sentences(band, random) : words(band, random)))
}

function square(rect: Rect, light: number, warmth: number, own: Random, delay: number): Wash {
  return { ...rect, kind: Kind.Square, ink: pigment(light, warmth), ink2: pigment(clamp(light + 0.1), warmth + 0.4 * (own() - 0.5)), density: 0.9 + 0.3 * own(), seed: four(own), extra: [0, 1, 0, 0], from: [0, own()], delay, lasts: 900, grow: 0 }
}

/** The words of a title in strong paint and those under it in pale, each as wide as it is long. */
function words(band: PaintBox, random: Random): Wash[] {
  const own = seeded(hashOf(band.key))
  const tone = toneOf(band.key)
  const parts = (text = '') => text.split(/\s+/).filter(Boolean)
  const strong = parts(band.element.dataset.strong)
  const all = [...strong.map((word) => ({ word, strong: true })), ...parts(band.element.dataset.pale).map((word) => ({ word, strong: false }))]
  const letter = Math.max(4.4, Math.min(8.5, (band.w * 0.72) / strong.reduce((sum, word) => sum + word.length + 0.8, 0)))
  const washes: Wash[] = []
  let x = band.x
  for (const one of all) {
    const w = Math.max(7, one.word.length * letter)
    if (x + w > band.x + band.w + 1) break
    const warmth = one.strong ? tone.warmth + 0.5 * (own() - 0.5) : 0.4 + 0.5 * own()
    const light = one.strong ? clamp(tone.light * 0.6 + 0.3 * own() ** 2) : 0.72 + 0.24 * own()
    washes.push(square({ x, y: band.y, w, h: band.h }, light, warmth, own, 700 * ((x - band.x) / band.w) + 150 * random()))
    x += w + 4.5
  }
  return washes
}

/** Every sentence of an article, in its order and as wide as it is long: deep for a heading, red for a question. */
function sentences(band: PaintBox, random: Random): Wash[] {
  const own = seeded(hashOf(band.key))
  const tone = toneOf(band.key)
  const found: { length: number; kind: 'heading' | 'question' | 'other'; block: number; element: Element }[] = []
  const prose = band.element.closest('article')?.querySelector('.wc-prose')
  ;[...(prose?.children ?? [])].forEach((element, block) => {
    const text = element.textContent?.trim() ?? ''
    if (/^H\d$/.test(element.tagName)) found.push({ length: text.length, kind: 'heading', block, element })
    else
      for (const sentence of text.match(/[^.!?\n]+[.!?]*/g) ?? [])
        if (sentence.trim().length > 2) found.push({ length: sentence.trim().length, kind: sentence.trim().endsWith('?') ? 'question' : 'other', block, element })
  })
  if (!found.length) return []
  const gap = 5
  const rows = clamp(Math.round(band.h / 25), 1, 9)
  const rowH = band.h / rows
  const total = found.reduce((sum, one) => sum + one.length, 0)
  // as many sentences to a row as make it full, and then the row is drawn out to its edge
  const perRow = total / rows
  const lines: (typeof found)[] = [[]]
  let sum = 0
  for (const one of found) {
    if (sum + one.length / 2 > perRow * lines.length && lines.length < rows) lines.push([])
    lines[lines.length - 1].push(one)
    sum += one.length
  }
  const washes: Wash[] = []
  lines.forEach((line, row) => {
    const letters = line.reduce((all, one) => all + one.length, 0)
    const room = band.w - gap * (line.length - 1)
    let x = band.x
    for (const one of line) {
      const w = (one.length / letters) * room
      const pale = 0.5 + 0.5 * Math.sin(one.block * 1.9 + tone.warmth * 6)
      const [light, warmth] =
        one.kind === 'heading' ? [0.02 + 0.14 * own(), 0.1 + 0.2 * own()] : one.kind === 'question' ? [0.24 + 0.1 * own(), 0.95] : [clamp(0.5 + 0.42 * pale + (own() - 0.5) * 0.24), tone.warmth + 0.55 * Math.sin(one.block * 2.4) + 0.2 * (own() - 0.5)]
      if (w > 3) washes.push({ ...square({ x, y: band.y + row * rowH, w, h: rowH - gap }, light, warmth, own, 160 * row + 500 * ((x - band.x) / band.w) + 100 * random()), leads: one.element })
      x += w + gap
    }
  })
  return washes
}
