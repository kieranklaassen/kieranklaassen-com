import type { Compose, Composition, PaintBox } from './compose_shared'
import { ear, type Gesture } from '../sound/ear'
import { clamp, seeded } from './pigments'
import { Kind, Painter, reachOf, type Rect, type Wash } from './painter'
import { splash } from './splash'

const TILE_HEIGHT = 512
// Watercolor is soft: past this many device pixels a page pixel, more only costs.
const MOST_PIXELS = 1.75
const LAYS_OVER = 1500
const DROP_LASTS = 1700
const MOST_SPLASHES = 12
// A window as tall as this is not looked through but looked at, as a page laid out on a board is.
const BOARD = 1600
const BOARD_PIXELS = 6_000_000

// Where somebody draws, the paint keeps still.
const DRAWN_ON = '.wc-ink, .wc-pens'

const GESTURE: Record<Kind, Gesture> = { [Kind.Square]: 'square', [Kind.Pencil]: 'square', [Kind.Letter]: 'letter', [Kind.Puddle]: 'puddle', [Kind.Bank]: 'bank', [Kind.Run]: 'run' }

interface Tile {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  rect: Rect
  painted: boolean
  dirty?: Rect
}

interface Moving {
  wash: Wash
  start: number
  lasts: number
  kind: 'lay' | 'flood' | 'drop'
  goal?: number
  began?: number
  drop?: [number, number, number, number]
  told?: boolean
}

const ease = (t: number) => 1 - (1 - t) ** 3

export function seedOfVisit() {
  const asked = new URLSearchParams(window.location.search).get('seed')
  if (asked) return Number(asked)
  return Math.floor(Math.random() * 2 ** 31)
}

/**
 * The paper under a page. It is painted in tiles, near the window only and only when something
 * changed, so a page at rest costs nothing and scrolling moves what is already painted.
 */
export function laySheet(sheet: HTMLElement, compose: Compose | Promise<Compose>, seed = seedOfVisit()): (() => void) | undefined {
  const shell = sheet.parentElement
  const painter = Painter.get()
  if (!shell || !painter) {
    if (typeof compose !== 'function') void compose.catch(() => {})
    return undefined
  }

  let composeFn: Compose | undefined = typeof compose === 'function' ? compose : undefined
  const loaded =
    typeof compose === 'function'
      ? Promise.resolve(compose)
      : compose.then(
          (fn) => (composeFn = fn),
          () => undefined,
        )

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let composition: Composition = { washes: [], paper: [1, 1, 1] }
  let tiles: Tile[] = []
  let waiting = new Set<Wash>()
  let moving: Moving[] = []
  let frameAsked = 0
  let composeAsked = 0
  let gone = false
  let started = false
  let ratio = 1
  let size = ''
  let under: Wash | undefined
  let first = true
  let splashes: Wash[][] = []

  const origin = () => sheet.getBoundingClientRect()

  const ask = () => {
    if (!frameAsked && !gone) frameAsked = requestAnimationFrame(frame)
  }

  const spoil = (wash: Wash) => {
    const reach = reachOf(wash)
    const x = wash.x - reach
    const y = wash.y - reach
    const right = wash.x + wash.w + reach
    const bottom = wash.y + wash.h + reach
    for (const tile of tiles) {
      if (bottom < tile.rect.y || y > tile.rect.y + tile.rect.h) continue
      const was = tile.dirty
      tile.dirty = was
        ? {
            x: Math.min(was.x, x),
            y: Math.min(was.y, y),
            w: Math.max(was.x + was.w, right) - Math.min(was.x, x),
            h: Math.max(was.y + was.h, bottom) - Math.min(was.y, y),
          }
        : { x, y, w: right - x, h: bottom - y }
    }
  }

  const showing = () => {
    const top = -origin().top
    return { top, bottom: top + window.innerHeight }
  }

  /** Tells whoever listens what a wash does. Nobody listens until Sound is pressed. */
  const tell = (wash: Wash, gesture: Gesture, lasts = 0) => {
    if (!ear.hears) return
    const { top, bottom } = showing()
    if (wash.y > bottom || wash.y + wash.h < top) return
    const [r, g, b] = wash.ink
    const pencil = wash.kind === Kind.Pencil
    ear.hears({
      gesture,
      pan: clamp(((wash.x + wash.w / 2) / window.innerWidth) * 2 - 1, -1, 1),
      size: pencil ? 0.01 : clamp(Math.sqrt(wash.w * wash.h) / 700),
      light: pencil ? 1 : clamp(r * 0.3 + g * 0.5 + b * 0.2),
      warmth: clamp(0.5 + (r - b) * 0.9),
      lasts: lasts / 1000,
      index: wash.index,
    })
  }

  // A wash is laid when it is first seen.
  const startSeen = (now: number) => {
    const { top, bottom } = showing()
    for (const wash of waiting) {
      if (wash.y > bottom + 40 || wash.y + wash.h < top - 40) continue
      waiting.delete(wash)
      const delay = (wash.delay ?? 0) * (first ? 1 : 0.35)
      moving.push({ wash, kind: 'lay', start: now + delay, lasts: wash.lasts ?? LAYS_OVER })
    }
    first = false
  }

  const move = (now: number) => {
    const still: Moving[] = []
    for (const one of moving) {
      const t = clamp((now - one.start) / one.lasts)
      if (now >= one.start) {
        if (!one.told) {
          one.told = true
          if (one.kind === 'lay') tell(one.wash, one.wash.kind === Kind.Letter && one.wash.index === undefined ? 'square' : GESTURE[one.wash.kind], one.lasts)
        }
        if (one.kind === 'lay') one.wash.grow = Math.max(0.001, ease(t))
        if (one.kind === 'flood') one.wash.grow = Math.max(0, (one.began ?? 0) + ((one.goal ?? 0) - (one.began ?? 0)) * ease(t))
        if (one.kind === 'drop' && one.drop) {
          const [x, y, radius, strength] = one.drop
          one.wash.drop = [x, y, 5 + (radius - 5) * ease(t), strength * clamp(t * 5)]
        }
        spoil(one.wash)
      }
      if (t < 1) still.push(one)
    }
    moving = still
  }

  const frame = (now: number) => {
    frameAsked = 0
    if (gone || !tiles.length) return
    startSeen(now)
    move(now)
    const { top, bottom } = showing()
    const margin = window.innerHeight * 0.75
    let owed = false
    const board = window.innerHeight > BOARD
    for (const tile of tiles) {
      const near = tile.rect.y < bottom + margin && tile.rect.y + tile.rect.h > top - margin
      if (!near) {
        if (tile.painted && (tile.rect.y > bottom + margin * 3 || tile.rect.y + tile.rect.h < top - margin * 3)) {
          tile.canvas.width = tile.canvas.height = 0
          tile.painted = false
        }
        continue
      }
      const inView = tile.rect.y < bottom && tile.rect.y + tile.rect.h > top
      if (!tile.painted) {
        if (owed && (!inView || board)) continue // one tile out of sight a frame, or of a whole board
        tile.canvas.width = Math.round(tile.rect.w * ratio)
        tile.canvas.height = Math.round(tile.rect.h * ratio)
        painter.paint(tile.context, tile.rect, tile.rect, composition.washes, ratio)
        tile.painted = true
        tile.dirty = undefined
        if (!inView || board) owed = true
      } else if (tile.dirty) {
        painter.paint(tile.context, tile.rect, tile.dirty, composition.washes, ratio)
        tile.dirty = undefined
      }
    }
    if (moving.length || owed) ask()
  }

  const measure = (): PaintBox[] => {
    const from = origin()
    return [...shell.querySelectorAll<HTMLElement>('[data-paint]')].map((element) => {
      const box = element.getBoundingClientRect()
      return {
        name: element.dataset.paint ?? '',
        key: element.dataset.key ?? element.textContent ?? '',
        element,
        x: box.left - from.left,
        y: box.top - from.top,
        w: box.width,
        h: box.height,
      }
    })
  }

  const lay = () => {
    cancelAnimationFrame(composeAsked)
    composeAsked = 0
    if (gone || !composeFn) return
    const width = shell.clientWidth
    const height = Math.max(shell.scrollHeight, window.innerHeight)
    const board = window.innerHeight > BOARD
    ratio = board ? Math.min(1, Math.sqrt(BOARD_PIXELS / (width * height))) : Math.min(window.devicePixelRatio || 1, MOST_PIXELS)
    const before = composition.washes
    const laidBefore = before.length > 0
    composition = composeFn({ width, height, boxes: measure, shell, random: seeded(seed) })
    size = `${width}x${Math.max(shell.scrollHeight, window.innerHeight)}`
    painter.setPaper(composition.paper)
    if (composition.course) painter.setCourse(composition.course)
    if (composition.mask) painter.setMask(composition.mask.width, composition.mask.height, composition.mask.field)
    moving = []
    waiting = new Set()
    splashes = []
    for (const wash of composition.washes) {
      if (wash.flood) wash.grow = 0
      else if (reduced || board || laidBefore) wash.grow = 1
      else {
        wash.grow = 0
        waiting.add(wash)
      }
    }
    for (const tile of tiles) tile.canvas.remove()
    tiles = []
    for (let y = 0; y < height; y += TILE_HEIGHT) {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return
      const rect = { x: 0, y, w: width, h: Math.min(TILE_HEIGHT, height - y) }
      canvas.style.cssText = `position:absolute;left:0;top:${y}px;width:${rect.w}px;height:${rect.h}px`
      canvas.width = canvas.height = 0
      sheet.append(canvas)
      tiles.push({ canvas, context, rect, painted: false })
    }
    shell.dataset.painted = ''
    under = undefined
    shell.dispatchEvent(new CustomEvent('wc:laid'))
    ask()
  }

  const layAgain = () => {
    const now = `${shell.clientWidth}x${Math.max(shell.scrollHeight, window.innerHeight)}`
    if (now === size || composeAsked) return
    composeAsked = requestAnimationFrame(lay)
  }

  const at = (event: MouseEvent) => {
    const from = origin()
    const x = event.clientX - from.left
    const y = event.clientY - from.top
    const wash = composition.washes
      .filter((w) => !w.still && !w.flood && w.grow > 0.9 && x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h)
      .pop()
    return { x, y, wash }
  }

  // A drop of water where the pointer comes into a wash: it pushes the pigment out to a ring.
  const fall = (event: PointerEvent) => {
    if (event.type === 'pointermove' && event.pointerType === 'touch') return
    if (event.target instanceof Element && event.target.closest(DRAWN_ON)) {
      under = undefined
      return
    }
    const { x, y, wash } = at(event)
    if (wash && (wash !== under || event.type === 'pointerdown')) {
      const radius = Math.min(64, 12 + 0.3 * Math.min(wash.w, wash.h))
      moving = moving.filter((one) => !(one.kind === 'drop' && one.wash === wash))
      moving.push({ wash, kind: 'drop', start: performance.now(), lasts: DROP_LASTS, drop: [x, y, radius, 1] })
      tell(wash, 'drop')
      ask()
    }
    under = wash
  }

  // Paint thrown at bare paper, where nothing is to be pressed and nobody is selecting what is written.
  const thrown = (event: MouseEvent) => {
    const target = event.target as Element | null
    if (!tiles.length || event.button || target?.closest(`a, button, input, pre, iframe, [data-of], ${DRAWN_ON}`)) return
    if (!window.getSelection()?.isCollapsed) return
    const { x, y, wash } = at(event)
    if (wash) return
    const washes = splash(x, y, Math.random)
    splashes.push(washes)
    composition.washes.push(...washes)
    const now = performance.now()
    for (const one of washes) moving.push({ wash: one, kind: 'lay', start: now + (one.delay ?? 0), lasts: one.lasts ?? 400, told: true })
    tell(washes[0], 'splash')
    for (const old of splashes.splice(0, splashes.length - MOST_SPLASHES)) {
      const gone = new Set(old)
      composition.washes = composition.washes.filter((one) => !gone.has(one))
      moving = moving.filter((one) => !gone.has(one.wash))
      old.forEach(spoil)
    }
    ask()
  }

  // Rain that is heard is seen: it falls on some wash in the window, and the wash is its note.
  const rained = () => {
    const { top, bottom } = showing()
    const seen = composition.washes.filter((w) => !w.still && !w.flood && w.grow > 0.9 && w.h > 12 && w.w > 12 && w.y + w.h / 2 > top && w.y + w.h / 2 < bottom)
    const wash = seen[Math.floor(Math.random() * seen.length)]
    if (!wash) return
    tell(wash, 'rain')
    if (reduced) return
    const drop: [number, number, number, number] = [wash.x + wash.w * (0.3 + 0.4 * Math.random()), wash.y + wash.h * (0.3 + 0.4 * Math.random()), Math.min(30, 6 + 0.22 * Math.min(wash.w, wash.h)), 0.9]
    moving = moving.filter((one) => !(one.kind === 'drop' && one.wash === wash))
    moving.push({ wash, kind: 'drop', start: performance.now(), lasts: DROP_LASTS, drop })
    ask()
  }

  // What the window holds, weighed by how much of it there is.
  const view = () => {
    const { top, bottom } = showing()
    let weight = 0
    let light = 0
    let warmth = 0
    for (const w of composition.washes) {
      if (w.kind === Kind.Pencil || w.flood || w.grow < 0.5 || w.y > bottom || w.y + w.h < top) continue
      const much = Math.min(w.w * w.h, 60_000)
      const [r, g, b] = w.ink
      weight += much
      light += much * clamp(r * 0.3 + g * 0.5 + b * 0.2)
      warmth += much * clamp(0.5 + (r - b) * 0.9)
    }
    return weight ? { light: light / weight, warmth: warmth / weight } : undefined
  }

  // The page is painted again, from bare paper.
  const again = () => {
    if (reduced) return
    moving = []
    first = true
    for (const wash of composition.washes) {
      if (wash.flood) continue
      wash.grow = 0
      wash.drop = undefined
      waiting.add(wash)
      spoil(wash)
    }
    ask()
  }

  // A stroke sounded: water falls on it, and where its other voices stand about the middle line.
  const heard = (event: Event) => {
    const staff = (event.target as Element).closest('[data-paint="staff"]')?.getBoundingClientRect()
    const own = composition.washes.find((one) => one.stands && one.stands === event.target)
    if (!own || !staff || reduced) return
    const x = own.x + own.w / 2
    const line = staff.top - origin().top + staff.height / 2
    const off = own.y + own.h / 2 - line
    ;[1, -1, 0.5, -0.5].forEach((share, i) => {
      const y = line + off * share
      const wash = i === 0 ? own : composition.washes.filter((w) => w.kind === 0 && !w.flood && x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h).pop()
      if (!wash) return
      moving = moving.filter((one) => !(one.kind === 'drop' && one.wash === wash))
      moving.push({ wash, kind: 'drop', start: performance.now() + i * 60, lasts: DROP_LASTS, drop: [x, y, Math.min(34, own.h * (i === 0 ? 0.5 : 0.42)), i === 0 ? 1 : 1.1] })
    })
    ask()
  }

  // A square that stands for a sentence leads to it.
  const led = (event: MouseEvent) => {
    const target = event.target as Element | null
    if (!target?.closest('[data-of="article"]')) return
    const from = origin()
    const x = event.clientX - from.left
    const y = event.clientY - from.top
    const wash = composition.washes.find((w) => w.leads && x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h)
    wash?.leads?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }

  const flood = (goal: number) => (event: Event) => {
    const target = event.target as Element | null
    const wash = composition.washes.find((w) => w.flood && target && (w.flood === target || w.flood.contains(target)))
    if (!wash) return
    const related = (event as PointerEvent).relatedTarget as Node | null
    if (related && wash.flood?.contains(related)) return
    if (goal && event instanceof PointerEvent) {
      const from = origin()
      wash.from = [clamp((event.clientX - from.left - wash.x) / wash.w), clamp((event.clientY - from.top - wash.y) / wash.h)]
    }
    moving = moving.filter((one) => one.wash !== wash)
    moving.push({ wash, kind: 'flood', start: performance.now(), lasts: reduced ? 1 : goal ? 900 : 500, goal, began: wash.grow })
    if (goal) tell(wash, 'flood', 900)
    ask()
  }
  const wet = flood(1)
  const dry = flood(0)
  const scrolled = () => ask()
  const restored = () => {
    painter.setUp()
    if (!started) return
    size = ''
    layAgain()
  }
  const lost = (event: Event) => event.preventDefault()

  const observer = new ResizeObserver(layAgain)
  // letters are cut from the face they are set in, and a face that is slow is not waited for
  const faces = document.fonts.ready
  void faces.then(() => {
    if (composition.washes.length && !gone) layAgain()
  })
  const faced = Promise.race([faces, new Promise((done) => window.setTimeout(done, 2500))])
  void Promise.all([painter.ready(), faced, loaded]).then(([paints]) => {
    if (gone || started) return
    if (!paints || !composeFn) return leave()
    started = true
    lay()
    observer.observe(shell)
  })
  window.addEventListener('scroll', scrolled, { passive: true })
  window.addEventListener('resize', scrolled, { passive: true })
  if (!reduced) {
    window.addEventListener('pointermove', fall, { passive: true })
    window.addEventListener('pointerdown', fall, { passive: true })
  }
  if (!reduced) shell.addEventListener('click', thrown)
  ear.view = view
  window.addEventListener('wc:rain', rained)
  window.addEventListener('wc:again', again)
  shell.addEventListener('wc:heard', heard)
  shell.addEventListener('click', led)
  shell.addEventListener('pointerover', wet)
  shell.addEventListener('pointerout', dry)
  shell.addEventListener('focusin', wet)
  shell.addEventListener('focusout', dry)
  painter.canvas.addEventListener('webglcontextlost', lost)
  painter.canvas.addEventListener('webglcontextrestored', restored)

  const leave = () => {
    gone = true
    cancelAnimationFrame(frameAsked)
    cancelAnimationFrame(composeAsked)
    observer.disconnect()
    window.removeEventListener('scroll', scrolled)
    window.removeEventListener('resize', scrolled)
    window.removeEventListener('pointermove', fall)
    window.removeEventListener('pointerdown', fall)
    shell.removeEventListener('click', thrown)
    if (ear.view === view) ear.view = undefined
    window.removeEventListener('wc:rain', rained)
    window.removeEventListener('wc:again', again)
    shell.removeEventListener('wc:heard', heard)
    shell.removeEventListener('click', led)
    painter.canvas.removeEventListener('webglcontextlost', lost)
    painter.canvas.removeEventListener('webglcontextrestored', restored)
    shell.removeEventListener('pointerover', wet)
    shell.removeEventListener('pointerout', dry)
    shell.removeEventListener('focusin', wet)
    shell.removeEventListener('focusout', dry)
    for (const tile of tiles) tile.canvas.remove()
    delete shell.dataset.painted
  }
  return leave
}
