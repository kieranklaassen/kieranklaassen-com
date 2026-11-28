import { grown, meets, noteInk, of, pencil, type PaintBox } from './compose_shared'
import { Kind, type Rect, type Wash } from './painter'
import { clamp, four, hashOf, pigment, seeded, type Random } from './pigments'

/** What is left of `cell` beside every rectangle in `taken`: the largest piece each time. */
export function beside(cell: Rect, taken: Rect[], least: number): Rect | undefined {
  let left = cell
  for (const t of taken) {
    if (!meets(left, t)) continue
    const pieces: Rect[] = [
      { x: left.x, y: left.y, w: t.x - left.x, h: left.h },
      { x: t.x + t.w, y: left.y, w: left.x + left.w - t.x - t.w, h: left.h },
      { x: left.x, y: left.y, w: left.w, h: t.y - left.y },
      { x: left.x, y: t.y + t.h, w: left.w, h: left.y + left.h - t.y - t.h },
    ]
    left = pieces.reduce((best, piece) => (piece.w > 0 && piece.h > 0 && piece.w * piece.h > Math.max(0, best.w * best.h) ? piece : best), { x: 0, y: 0, w: 0, h: 0 })
    if (left.w < least || left.h < least) return undefined
  }
  return left.w < least || left.h < least ? undefined : left
}

export function staffWashes(boxes: PaintBox[], random: Random): Wash[] {
  const washes: Wash[] = []
  const staff = of(boxes, 'staff')[0]
  const notes = of(boxes, 'note')
  const turn = random() * 6
  if (!staff) return []

  const lanes = Math.max(1, Number(staff.element.dataset.lanes ?? 8))
  const lane = staff.h / lanes
  const taken = notes.map((note) => grown(note, 3))
  for (let j = 0; j < lanes; j++) {
    let x = staff.x + (random() - 0.5) * 16
    const bottom = staff.y + (j + 1) * lane
    while (x < staff.x + staff.w - 10) {
      let w = lane * (0.28 + 0.95 * random())
      if (random() < 0.14) w *= 1.8
      w = Math.min(w, staff.x + staff.w - x)
      if (staff.x + staff.w - x - w < 16) w = staff.x + staff.w - x
      const whole = { x: x + 3, y: bottom - lane + 3, w: w - 6, h: lane - 6 }
      const halves = random() > 0.82 ? [{ ...whole, h: whole.h / 2 - 3 }, { ...whole, y: whole.y + whole.h / 2 + 3, h: whole.h / 2 - 3 }] : [whole]
      halves.forEach((part, odd) => {
        const cell = beside(part, taken, 10)
        if (!cell) return
        const cx = (cell.x + cell.w / 2 - staff.x) / staff.w
        const cy = (j + 0.5) / lanes
        const away = Math.hypot((cx - 0.56) * 1.9, (cy - 0.46) * 1.5)
        const light = clamp(1.16 - 0.78 * away + (random() - 0.5) * 0.24)
        const w2 = 0.46 + 0.34 * Math.sin(cx * 3.6 - cy * 2.4 + turn) + (odd - 0.5) * 0.6 + (random() - 0.5) * 0.6
        washes.push({ ...cell, kind: Kind.Square, ink: pigment(light, w2), ink2: pigment(clamp(light + 0.05), w2 + 0.4 * (random() - 0.5)), density: 0.5 + 0.4 * random(), seed: four(random), extra: [0, 1, 0, 0], from: [0, random()], delay: 1500 * cx + 250 * random(), lasts: 900, grow: 0 })
      })
      x += w
    }
    washes.push(pencil({ x: staff.x - 10, y: bottom - 1.5, w: staff.w + 20, h: 3 }, random))
  }
  for (const note of notes) {
    const [ink, ink2] = noteInk(note.key)
    washes.push({ ...note, kind: Kind.Square, ink, ink2, density: 1.12, seed: four(seeded(hashOf(note.key))), extra: [0, 1, 0, 0], from: [0, 0.5], delay: 300 + 1500 * ((note.x - staff.x) / staff.w), lasts: 1200, grow: 0, stands: note.element })
  }
  for (const tick of of(boxes, 'tick')) washes.push(pencil({ x: tick.x - 1, y: staff.y - 14, w: 3, h: staff.h + 28 }, random))
  // the line the voices are mirrored in
  for (const by of [-2, 0.5]) washes.push(pencil({ x: staff.x - 22, y: staff.y + staff.h / 2 + by, w: staff.w + 44, h: 3 }, random))
  return washes
}

export function swatchWash(swatch: PaintBox, random: Random): Wash {
  const own = seeded(hashOf(swatch.key))
  const [ink, ink2] = noteInk(swatch.key)
  return { ...swatch, kind: Kind.Square, ink, ink2, density: 1.1, seed: four(own), extra: [0, 1, 0, 0], from: [own(), own()], delay: 400 + 500 * random(), lasts: 1100, grow: 0 }
}
