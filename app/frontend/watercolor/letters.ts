// The letters of a heading as a distance field, so that a wash can be laid in each of them.

const FAR = 1e20
const PAD = 14
const SCALE = 0.5

export interface Letter {
  char: string
  x: number
  y: number
  w: number
  h: number
  uv: [number, number, number, number]
  /** For every mask pixel across the letter, the page y of its lowest painted pixel. */
  feet: { x: number; y: number }[]
}

export interface Mask {
  width: number
  height: number
  field: Uint8Array
}

function transform(grid: Float64Array, offset: number, stride: number, n: number, f: Float64Array, v: Uint16Array, z: Float64Array) {
  v[0] = 0
  z[0] = -FAR
  z[1] = FAR
  f[0] = grid[offset]
  for (let q = 1, k = 0; q < n; q++) {
    f[q] = grid[offset + q * stride]
    const q2 = q * q
    let s: number
    do {
      const r = v[k]
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2
    } while (s <= z[k] && --k > -1)
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = FAR
  }
  for (let q = 0, k = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const r = v[k]
    grid[offset + q * stride] = f[r] + (q - r) * (q - r)
  }
}

function distances(grid: Float64Array, w: number, h: number) {
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const v = new Uint16Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) transform(grid, x, w, h, f, v, z)
  for (let y = 0; y < h; y++) transform(grid, y * w, 1, w, f, v, z)
}

/** Every letter of `element` where the page shows it, and one mask that holds them all. */
export function lettersOf(element: HTMLElement, originX: number, originY: number): { letters: Letter[]; mask: Mask; field: number } | undefined {
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
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return undefined
  const font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`
  context.font = font
  const ascent = context.measureText('Hg').fontBoundingBoxAscent
  const cellH = Math.ceil((fontSize * 1.5 + PAD * 2) * SCALE)
  const widths = found.map(({ char }) => Math.ceil((context.measureText(char).width + fontSize * 0.12 + PAD * 2) * SCALE))
  const atlas: { x: number; y: number }[] = []
  let x = 0
  let y = 0
  const atlasW = Math.max(1024, ...widths)
  for (const w of widths) {
    if (x + w > atlasW) {
      x = 0
      y += cellH
    }
    atlas.push({ x, y })
    x += w
  }
  canvas.width = atlasW
  canvas.height = y + cellH
  context.scale(SCALE, SCALE)
  context.font = font
  context.textBaseline = 'alphabetic'
  const fieldReach = fontSize * 0.09
  const out = new Uint8Array(canvas.width * canvas.height)
  const letters: Letter[] = []
  found.forEach(({ char, box }, i) => {
    const w = widths[i]
    const left = atlas[i].x / SCALE + PAD
    const base = atlas[i].y / SCALE + PAD + fontSize * 1.1
    context.fillText(char, left, base)
    const pixels = context.getImageData(atlas[i].x, atlas[i].y, w, cellH).data
    const outside = new Float64Array(w * cellH)
    const inside = new Float64Array(w * cellH)
    const pageLeft = box.left - originX - PAD
    const pageTop = box.top - originY + ascent - fontSize * 1.1 - PAD
    const feet: Letter['feet'] = []
    for (let px = 0; px < w; px++) {
      for (let py = cellH - 1; py >= 0; py--) {
        if (pixels[(py * w + px) * 4 + 3] > 127) {
          feet.push({ x: pageLeft + px / SCALE, y: pageTop + py / SCALE })
          break
        }
      }
    }
    for (let p = 0; p < w * cellH; p++) {
      const a = pixels[p * 4 + 3] / 255
      outside[p] = a === 1 ? 0 : a === 0 ? FAR : Math.max(0, 0.5 - a) ** 2
      inside[p] = a === 0 ? 0 : a === 1 ? FAR : Math.max(0, a - 0.5) ** 2
    }
    distances(outside, w, cellH)
    distances(inside, w, cellH)
    for (let py = 0; py < cellH; py++) {
      for (let px = 0; px < w; px++) {
        const p = py * w + px
        const d = (Math.sqrt(inside[p]) - Math.sqrt(outside[p])) / SCALE
        out[(atlas[i].y + py) * canvas.width + atlas[i].x + px] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + d / fieldReach / 2)))
      }
    }
    letters.push({
      char,
      x: pageLeft,
      y: pageTop,
      w: w / SCALE,
      h: cellH / SCALE,
      uv: [atlas[i].x / canvas.width, atlas[i].y / canvas.height, w / canvas.width, cellH / canvas.height],
      feet,
    })
  })
  return { letters, mask: { width: canvas.width, height: canvas.height, field: out }, field: fieldReach }
}
