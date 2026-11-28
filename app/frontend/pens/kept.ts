import type { Anchor, Point, Stroke } from './ink'
import { holds, isPen, PEN_NAMES, PENS, type PenName } from './pens'

export interface Change {
  added: Stroke[]
  removed: Stroke[]
}

export type Colours = Record<PenName, string>

const VERSION = 1
const COLOURS = 'wc-pens'
const keyOf = (path: string) => `wc-ink:${path}`

export const FIRST_COLOURS = Object.fromEntries(PEN_NAMES.map((pen) => [pen, PENS[pen].colours[0][1]])) as Colours

const finite = (...all: unknown[]) => all.every(Number.isFinite)

const isPoint = (one: unknown): one is Point => Array.isArray(one) && one.length === 3 && finite(...one)

function isAnchor(one: Partial<Anchor> | null | undefined): one is Anchor {
  if (!one || typeof one.starts !== 'string' || !finite(one.block, one.w, one.h)) return false
  const { words } = one
  return words === undefined || (words !== null && finite(words.from, words.to, words.x, words.y, words.w, words.h))
}

function isStroke(one: Partial<Stroke> | null): one is Stroke {
  if (!one || typeof one.id !== 'string' || !isPen(one.pen) || !holds(one.pen, one.colour)) return false
  return Array.isArray(one.points) && one.points.length > 0 && one.points.every(isPoint) && isAnchor(one.at)
}

export function withChange(strokes: Stroke[], { added, removed }: Change) {
  const gone = new Set(removed.map(({ id }) => id))
  return [...strokes.filter(({ id }) => !gone.has(id)), ...added]
}

/** What was drawn on a page before. What cannot be read is left out. */
export function keptInk(path: string): Stroke[] {
  try {
    const { version, strokes } = JSON.parse(localStorage.getItem(keyOf(path)) ?? '{}')
    return version === VERSION && Array.isArray(strokes) ? strokes.filter(isStroke) : []
  } catch {
    return []
  }
}

/** Keeps one change and nothing else, so that a page open twice loses neither's ink. */
export function keepChange(path: string, change: Change) {
  try {
    localStorage.setItem(keyOf(path), JSON.stringify({ version: VERSION, strokes: withChange(keptInk(path), change) }))
  } catch {
    // a browser that keeps nothing is drawn on for as long as the page is open
  }
}

export function colours(): Colours {
  try {
    const kept = JSON.parse(localStorage.getItem(COLOURS) ?? '{}')
    return Object.fromEntries(PEN_NAMES.map((pen) => [pen, holds(pen, kept[pen]) ? kept[pen] : FIRST_COLOURS[pen]])) as Colours
  } catch {
    return FIRST_COLOURS
  }
}

export function keepColours(chosen: Colours) {
  try {
    localStorage.setItem(COLOURS, JSON.stringify(chosen))
  } catch {
    // the pens come back in their first colours
  }
}

