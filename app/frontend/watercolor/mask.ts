// Outlines as distance fields, all on one sheet, so that a wash can be laid in any shape.

const FAR = 1e20
const SHEET = 2048

export interface Mask {
  width: number
  height: number
  field: Uint8Array
}

export interface Cut {
  /** Where the outline is on the sheet. It is known once the sheet is made. */
  uv: [number, number, number, number]
  /** In mask pixels. */
  w: number
  h: number
  alpha: Uint8ClampedArray
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

/** Outlines are cut one by one, and then the sheet that holds them all is made. */
export class Cutter {
  private cuts: (Cut & { field: Uint8Array })[] = []
  private canvas = document.createElement('canvas')
  private context = this.canvas.getContext('2d', { willReadFrequently: true })

  /** Cuts what `draw` draws on a page piece of `width` by `height`. `reach` is how far the field goes, in page pixels. */
  cut(width: number, height: number, scale: number, reach: number, draw: (context: CanvasRenderingContext2D) => void): Cut {
    const { canvas, context } = this
    const w = Math.min(SHEET, Math.max(1, Math.ceil(width * scale)))
    const h = Math.max(1, Math.ceil(height * scale))
    if (canvas.width < w || canvas.height < h) {
      canvas.width = Math.max(canvas.width, w)
      canvas.height = Math.max(canvas.height, h)
    }
    const alpha = new Uint8ClampedArray(w * h)
    const field = new Uint8Array(w * h)
    if (context) {
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, w, h)
      context.setTransform(scale, 0, 0, scale, 0, 0)
      draw(context)
      const pixels = context.getImageData(0, 0, w, h).data
      const outside = new Float64Array(w * h)
      const inside = new Float64Array(w * h)
      for (let p = 0; p < w * h; p++) {
        alpha[p] = pixels[p * 4 + 3]
        const a = alpha[p] / 255
        outside[p] = a === 1 ? 0 : a === 0 ? FAR : Math.max(0, 0.5 - a) ** 2
        inside[p] = a === 0 ? 0 : a === 1 ? FAR : Math.max(0, a - 0.5) ** 2
      }
      distances(outside, w, h)
      distances(inside, w, h)
      for (let p = 0; p < w * h; p++) {
        const d = (Math.sqrt(inside[p]) - Math.sqrt(outside[p])) / scale
        field[p] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + d / reach / 2)))
      }
    }
    const cut = { uv: [0, 0, 1, 1] as Cut['uv'], w, h, alpha, field }
    this.cuts.push(cut)
    return cut
  }

  sheet(): Mask | undefined {
    if (!this.cuts.length) return undefined
    const tall = [...this.cuts].sort((a, b) => b.h - a.h)
    const places = new Map<Cut, { x: number; y: number }>()
    let x = 0
    let y = 0
    let row = 0
    for (const cut of tall) {
      if (x + cut.w > SHEET) {
        x = 0
        y += row + 1
        row = 0
      }
      places.set(cut, { x, y })
      x += cut.w + 1
      row = Math.max(row, cut.h)
    }
    const height = y + row
    const field = new Uint8Array(SHEET * height)
    for (const cut of this.cuts) {
      const at = places.get(cut)!
      for (let r = 0; r < cut.h; r++) field.set(cut.field.subarray(r * cut.w, (r + 1) * cut.w), (at.y + r) * SHEET + at.x)
      cut.uv.splice(0, 4, at.x / SHEET, at.y / height, cut.w / SHEET, cut.h / height)
    }
    return { width: SHEET, height, field }
  }
}
