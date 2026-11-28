import { memo, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { onUnfolded, tellUnfolded } from '../looks/fold'
import { seeded } from '../watercolor/pigments'
import { anchor, blocksOf, place } from './anchor'
import { hits, inkOf, pressed, type Point, type Stroke } from './ink'
import { colours as keptColours, FIRST_COLOURS, keepChange, keepColours, keptInk, withChange, type Change, type Colours } from './kept'
import { PenPicture } from './pen_pictures'
import { PEN_NAMES, PENS, type PenName, type Tool } from './pens'

const TOOLS: Tool[] = [...PEN_NAMES, 'eraser']
const RUBBER = 9
// Nearer than this to the point before, a point says nothing.
const NEAR = 1.4
const GRAIN = 26

const titleOf = (tool: Tool) => (tool === 'eraser' ? 'Eraser' : PENS[tool].title)
// A page that is not served securely has no randomUUID.
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const grainOf = (colour: string) => `wc-grain-${colour.slice(1)}`

const SPECKS = (() => {
  const random = seeded(7)
  return Array.from({ length: 420 }, () => `M${(random() * GRAIN).toFixed(1)} ${(random() * GRAIN).toFixed(1)}h${(0.4 + 0.5 * random()).toFixed(1)}v0.7h-0.5z`).join('')
})()

/** Graphite catches on the paper's tooth and leaves the rest bare. */
const Grains = memo(function Grains() {
  return (
    <defs>
      {PENS.pencil.colours.map(([, colour]) => (
        <pattern key={colour} id={grainOf(colour)} width={GRAIN} height={GRAIN} patternUnits="userSpaceOnUse">
          <path d={`M0 0h${GRAIN}v${GRAIN}H0z`} fill={colour} opacity="0.62" />
          <path d={SPECKS} fill={colour} />
        </pattern>
      ))}
    </defs>
  )
})

/** How a pen's ink is drawn, for what is drawn and for what is being drawn. */
function drawn(name: PenName, colour: string, points: Point[]) {
  const pen = PENS[name]
  const { d, width } = inkOf(pen, points)
  const paint = pen.grain ? `url(#${grainOf(colour)})` : colour
  return width
    ? { d, fill: 'none', stroke: paint, strokeWidth: width, strokeLinecap: pen.chisel ? ('butt' as const) : ('round' as const), strokeLinejoin: 'round' as const, opacity: pen.opacity }
    : { d, fill: paint, opacity: pen.opacity }
}

const Ink = memo(function Ink({ stroke, pieces }: { stroke: Stroke; pieces: Point[][] }) {
  return pieces.map((points, i) => <path key={i} data-stroke={stroke.id} {...drawn(stroke.pen, stroke.colour, points)} />)
})

interface Drawing {
  pointer: number
  points: Point[]
  at: number
}

/** The pens, and what is drawn with them on one page. */
export function Pens({ path }: { path: string }) {
  const layer = useRef<HTMLDivElement>(null)
  const mine = useRef<Stroke[]>([])
  const done = useRef<Change[]>([])
  const drawing = useRef<Drawing>(undefined)
  const rubbing = useRef<{ pointer: number; at: [number, number] }>(undefined)
  const touches = useRef(new Map<number, number>())
  const panning = useRef(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [places, setPlaces] = useState(new Map<string, Point[][]>())
  const [live, setLive] = useState<Point[]>()
  const [held, setHeld] = useState<Tool>()
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<Colours>(FIRST_COLOURS)

  useEffect(() => {
    mine.current = keptInk(path)
    setStrokes(mine.current)
    setChosen(keptColours())
  }, [path])

  useEffect(() => onUnfolded('sound', () => setOpen(false)), [])

  // The page is laid out anew now and then, and the ink goes with what it is on.
  useEffect(() => {
    const shell = layer.current?.parentElement
    if (!shell) return
    const lay = () => {
      const blocks = blocksOf(shell)
      setPlaces(new Map(strokes.map((stroke) => [stroke.id, place(stroke, blocks, shell) ?? []])))
    }
    lay()
    setLive(undefined)
    if (!strokes.length) return
    let left = false
    const observer = new ResizeObserver(lay)
    observer.observe(shell)
    shell.addEventListener('wc:laid', lay)
    void document.fonts?.ready.then(() => left || lay())
    return () => {
      left = true
      observer.disconnect()
      shell.removeEventListener('wc:laid', lay)
    }
  }, [strokes])

  const drop = () => {
    drawing.current = rubbing.current = undefined
    setLive(undefined)
  }

  const putDown = () => {
    drop()
    touches.current.clear()
    panning.current = false
    setHeld(undefined)
  }

  useEffect(() => {
    if (!held) return
    const escaped = (event: KeyboardEvent) => event.key === 'Escape' && putDown()
    window.addEventListener('keydown', escaped)
    return () => window.removeEventListener('keydown', escaped)
  }, [held])

  const change = (one: Change, remembered = true) => {
    mine.current = withChange(mine.current, one)
    setStrokes(mine.current)
    keepChange(path, one)
    if (remembered) done.current.push(one)
  }

  const undo = () => {
    const last = done.current.pop()
    if (last) change({ added: last.removed, removed: last.added }, false)
  }

  // What another tab has drawn here since goes too.
  const clear = () => {
    const known = new Set(mine.current.map(({ id }) => id))
    change({ added: [], removed: [...mine.current, ...keptInk(path).filter(({ id }) => !known.has(id))] })
  }

  const at = (event: { clientX: number; clientY: number }): [number, number] => {
    const from = layer.current!.getBoundingClientRect()
    return [event.clientX - from.left, event.clientY - from.top]
  }

  const rub = (from: [number, number], to: [number, number]) => {
    const removed = mine.current.filter(({ id, pen }) => places.get(id)?.some((points) => hits(points, RUBBER + PENS[pen].width / 2, from, to)))
    if (removed.length) change({ added: [], removed })
  }

  const middle = () => [...touches.current.values()].reduce((sum, y) => sum + y, 0) / touches.current.size

  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!held || event.button) return
    event.preventDefault()
    if (event.pointerType === 'touch') touches.current.set(event.pointerId, event.clientY)
    if (touches.current.size > 1) {
      panning.current = true
      return drop()
    }
    if (panning.current || drawing.current || rubbing.current) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const [x, y] = at(event)
    if (held === 'eraser') {
      rubbing.current = { pointer: event.pointerId, at: [x, y] }
      return rub([x, y], [x, y])
    }
    drawing.current = { pointer: event.pointerId, points: [[x, y, pressed(PENS[held], event, 0.6, 1)]], at: event.timeStamp }
    setLive([...drawing.current.points])
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (touches.current.has(event.pointerId)) {
      const before = middle()
      touches.current.set(event.pointerId, event.clientY)
      if (panning.current) {
        if (touches.current.size > 1) window.scrollBy({ top: before - middle(), behavior: 'instant' })
        return
      }
    }
    const rubbed = rubbing.current
    if (rubbed?.pointer === event.pointerId) {
      const to = at(event)
      rub(rubbed.at, to)
      rubbed.at = to
      return
    }
    const line = drawing.current
    if (line?.pointer !== event.pointerId || !held || held === 'eraser') return
    for (const one of event.nativeEvent.getCoalescedEvents?.() ?? []) draw(line, PENS[held], one)
    draw(line, PENS[held], event)
    setLive([...line.points])
  }

  const draw = (line: Drawing, pen: (typeof PENS)[PenName], event: { clientX: number; clientY: number; timeStamp: number; pointerType: string; pressure: number }) => {
    const [x, y] = at(event)
    const [bx, by, before] = line.points[line.points.length - 1]
    const gone = Math.hypot(x - bx, y - by)
    if (gone < NEAR) return
    const speed = gone / Math.max(1, event.timeStamp - line.at)
    line.points.push([x, y, pressed(pen, event, speed, before)])
    line.at = event.timeStamp
  }

  const lift = (event: PointerEvent<HTMLDivElement>) => {
    touches.current.delete(event.pointerId)
    if (!touches.current.size) panning.current = false
    if (rubbing.current?.pointer === event.pointerId) rubbing.current = undefined
    const line = drawing.current
    const shell = layer.current?.parentElement
    if (line?.pointer !== event.pointerId || !shell || !held || held === 'eraser') return
    drawing.current = undefined
    change({ added: [{ id: newId(), pen: held, colour: chosen[held], ...anchor(line.points, shell) }], removed: [] })
  }

  const cancel = (event: PointerEvent<HTMLDivElement>) => {
    touches.current.delete(event.pointerId)
    if (!touches.current.size) panning.current = false
    if (drawing.current?.pointer === event.pointerId || rubbing.current?.pointer === event.pointerId) drop()
  }

  const take = (tool: Tool) => {
    if (tool === held) return putDown()
    drop()
    setHeld(tool)
  }

  const dip = (pen: PenName, colour: string) => {
    const next = { ...chosen, [pen]: colour }
    setChosen(next)
    keepColours(next)
  }

  const unfold = () => {
    if (!open) tellUnfolded('pens')
    setOpen(!open)
  }

  const pen = held === 'eraser' ? undefined : held
  const inked = strokes.length > 0 || live !== undefined
  const colourOf = (tool: Tool) => (tool === 'eraser' ? '' : chosen[tool])

  return (
    <>
      <div ref={layer} className="wc-ink" data-held={held} data-inked={inked || undefined} aria-hidden="true" onPointerDown={down} onPointerMove={move} onPointerUp={lift} onPointerCancel={cancel}>
        {inked && (
          <svg>
            <Grains />
            {strokes.map((stroke) => {
              const pieces = places.get(stroke.id)
              return pieces && <Ink key={stroke.id} stroke={stroke} pieces={pieces} />
            })}
            {live && pen && <path {...drawn(pen, chosen[pen], live)} />}
          </svg>
        )}
      </div>
      <div className="wc-pens" role="group" aria-label="Pens">
        {open && (
          <div className="wc-tray">
            <div className="wc-stand">
              {TOOLS.map((tool) => (
                <button key={tool} type="button" className="wc-pen" aria-pressed={held === tool} aria-label={titleOf(tool)} title={titleOf(tool)} onClick={() => take(tool)}>
                  <PenPicture tool={tool} colour={colourOf(tool)} />
                </button>
              ))}
            </div>
            <div className="wc-inks">
              {pen &&
                PENS[pen].colours.map(([name, colour]) => (
                  <button key={colour} type="button" className="wc-dip" aria-pressed={chosen[pen] === colour} aria-label={`${name} ink`} title={name} style={{ '--dip': colour } as CSSProperties} onClick={() => dip(pen, colour)} />
                ))}
              <span className="wc-back-out">
                <button type="button" disabled={!done.current.length} onClick={undo}>
                  Undo
                </button>
                <button type="button" disabled={!strokes.length} onClick={clear}>
                  Clear page
                </button>
              </span>
            </div>
          </div>
        )}
        <div className="wc-row">
          <button type="button" className="wc-hold" aria-expanded={open} aria-label={held ? `Pens, holding the ${titleOf(held).toLowerCase()}` : 'Pens'} onClick={unfold}>
            <PenPicture tool={held ?? 'pencil'} colour={colourOf(held ?? 'pencil')} />
            <span>{held ? titleOf(held) : 'Pens'}</span>
          </button>
          {held && (
            <button type="button" className="wc-down" onClick={putDown}>
              Put down
            </button>
          )}
        </div>
      </div>
    </>
  )
}
