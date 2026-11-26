// A small hand for drawing: every function gives the outline of one shape as a path.

const n = (x: number) => Math.round(x * 100) / 100
const at = (x: number, y: number) => `${n(x)} ${n(y)}`
const turned = (x: number, y: number, dx: number, dy: number, angle: number) => {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return at(x + dx * c - dy * s, y + dx * s + dy * c)
}

export const oval = (x: number, y: number, rx: number, ry = rx) =>
  `M${at(x - rx, y)}A${n(rx)} ${n(ry)} 0 1 1 ${at(x + rx, y)}A${n(rx)} ${n(ry)} 0 1 1 ${at(x - rx, y)}Z`

/** Half a disc, its flat side down when it is not turned. */
export const half = (x: number, y: number, r: number, angle = 0) =>
  `M${turned(x, y, -r, 0, angle)}A${n(r)} ${n(r)} 0 0 1 ${turned(x, y, r, 0, angle)}Z`

export const quad = (...points: number[]) => {
  let d = ''
  for (let i = 0; i < points.length; i += 2) d += `${i ? 'L' : 'M'}${at(points[i], points[i + 1])}`
  return `${d}Z`
}

export const box = (x: number, y: number, w: number, h: number) => quad(x, y, x + w, y, x + w, y + h, x, y + h)

/** From its stalk, so long, so wide, leaning so far. Angle 0 points to the right. */
export const leaf = (x: number, y: number, long: number, wide: number, angle: number) =>
  `M${at(x, y)}Q${turned(x, y, long * 0.42, -wide, angle)} ${turned(x, y, long, 0, angle)}Q${turned(x, y, long * 0.42, wide, angle)} ${at(x, y)}Z`

/** An open line through its points, rounded. */
export const line = (...points: number[]) => {
  let d = `M${at(points[0], points[1])}`
  if (points.length === 4) return `${d}L${at(points[2], points[3])}`
  for (let i = 2; i < points.length - 2; i += 2) {
    const last = i === points.length - 4
    const ex = last ? points[i + 2] : (points[i] + points[i + 2]) / 2
    const ey = last ? points[i + 3] : (points[i + 1] + points[i + 3]) / 2
    d += `Q${at(points[i], points[i + 1])} ${at(ex, ey)}`
  }
  return d
}

export const bow = (x: number, y: number, r: number, from: number, to: number) =>
  `M${at(x + r * Math.cos(from), y + r * Math.sin(from))}A${n(r)} ${n(r)} 0 ${Math.abs(to - from) > Math.PI ? 1 : 0} ${to > from ? 1 : 0} ${at(x + r * Math.cos(to), y + r * Math.sin(to))}`

/** A bird on the wing: so big, leaning so far. */
export const wing = (x: number, y: number, s: number, angle = 0) => {
  const p = (dx: number, dy: number) => turned(x, y, dx * s, dy * s, angle)
  return `M${p(-1, 0.05)}C${p(-0.6, -0.08)} ${p(-0.35, -0.12)} ${p(-0.2, -0.16)}C${p(-0.42, -0.5)} ${p(-0.4, -0.85)} ${p(-0.22, -1.1)}C${p(-0.02, -0.72)} ${p(0.16, -0.42)} ${p(0.34, -0.22)}C${p(0.5, -0.3)} ${p(0.66, -0.28)} ${p(0.76, -0.16)}L${p(1.02, -0.1)}L${p(0.78, -0.02)}C${p(0.62, 0.22)} ${p(0.2, 0.34)} ${p(-0.1, 0.22)}C${p(-0.4, 0.14)} ${p(-0.7, 0.12)} ${p(-1, 0.22)}L${p(-0.86, 0.12)}Z`
}

/** A bird that sits, its beak to the right, or to the left when `s` is below nought. */
export const perched = (x: number, y: number, size: number, way = 1) => {
  const p = (dx: number, dy: number) => at(x + dx * size * way, y + dy * size)
  return `M${p(0.92, -0.62)}L${p(0.66, -0.5)}C${p(0.66, -0.1)} ${p(0.4, 0.24)} ${p(0, 0.28)}C${p(-0.16, 0.3)} ${p(-0.3, 0.26)} ${p(-0.4, 0.2)}L${p(-0.98, 0.52)}L${p(-1.02, 0.36)}L${p(-0.6, 0.02)}C${p(-0.52, -0.3)} ${p(-0.24, -0.44)} ${p(0.06, -0.52)}C${p(0.12, -0.84)} ${p(0.56, -0.96)} ${p(0.68, -0.7)}Z`
}

export const heart = (x: number, y: number, s: number) =>
  `M${at(x, y + s)}C${at(x - s * 1.5, y)} ${at(x - s, y - s * 1.1)} ${at(x, y - s * 0.35)}C${at(x + s, y - s * 1.1)} ${at(x + s * 1.5, y)} ${at(x, y + s)}Z`

export const drop = (x: number, y: number, s: number) =>
  `M${at(x, y - s * 1.5)}C${at(x + s * 0.3, y - s * 0.7)} ${at(x + s, y - s * 0.4)} ${at(x + s, y + s * 0.2)}A${n(s)} ${n(s)} 0 1 1 ${at(x - s, y + s * 0.2)}C${at(x - s, y - s * 0.4)} ${at(x - s * 0.3, y - s * 0.7)} ${at(x, y - s * 1.5)}Z`

/** A crescent, open to the side it is turned from. */
export const crescent = (x: number, y: number, r: number, angle = 0) =>
  `M${turned(x, y, 0.35 * r, -r * 0.94, angle)}A${n(r)} ${n(r)} 0 1 0 ${turned(x, y, 0.35 * r, r * 0.94, angle)}A${n(r * 0.98)} ${n(r * 1.02)} 0 0 1 ${turned(x, y, 0.35 * r, -r * 0.94, angle)}Z`

/** A stone worn round: no two are alike, by `k`. */
export const stone = (x: number, y: number, rx: number, ry: number, k = 1) => {
  const p = (a: number, f: number) => [x + rx * f * Math.cos(a), y + ry * f * Math.sin(a)] as const
  const all = Array.from({ length: 8 }, (_, i) => p((i / 8) * Math.PI * 2, 1 + 0.1 * Math.sin(i * 2.4 * k + k)))
  const mid = all.map((one, i) => [(one[0] + all[(i + 1) % 8][0]) / 2, (one[1] + all[(i + 1) % 8][1]) / 2] as const)
  return `M${at(mid[7][0], mid[7][1])}${all.map((one, i) => `Q${at(one[0], one[1])} ${at(mid[i][0], mid[i][1])}`).join('')}Z`
}

/** A band of water from x to x: its crests, and its foot. */
export const waves = (x: number, y: number, w: number, h: number, count: number, lift: number) => {
  const step = w / count
  let d = `M${at(x, y)}`
  for (let i = 0; i < count; i++) d += `q${n(step / 4)} ${n(-lift)} ${n(step / 2)} 0q${n(step / 4)} ${n(lift)} ${n(step / 2)} 0`
  return `${d}L${at(x + w, y + h)}L${at(x, y + h)}Z`
}
