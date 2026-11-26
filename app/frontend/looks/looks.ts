import { around, book, river, wide } from '../watercolor/article'
import { estuary, longPage, mosaic, paintedName, score, smallSquares, type Compose } from '../watercolor/compose'

/** A way of painting one page, or one part of it. */
export type Room = 'page' | 'name' | 'estuary' | 'score' | 'mosaic'
/** What can be chosen: one room for the whole site, a room for each page, or the site as it was. */
export type Look = 'blocks' | 'long' | 'rooms' | Room

export const LOOKS: { look: Look; title: string }[] = [
  { look: 'blocks', title: 'As it is' },
  { look: 'long', title: 'One long page' },
  { look: 'rooms', title: 'A look for each page' },
  { look: 'name', title: 'Painted name' },
  { look: 'estuary', title: 'Estuary' },
  { look: 'score', title: 'Score' },
  { look: 'mosaic', title: 'Mosaic' },
  { look: 'page', title: 'The page is the painting' },
]

/** A way of laying an article round its painting. */
export type Art = 'wide' | 'book' | 'around' | 'river'

export const ARTS: { art: Art; title: string }[] = [
  { art: 'wide', title: 'Edge to edge' },
  { art: 'book', title: 'Book' },
  { art: 'around', title: 'Around the words' },
  { art: 'river', title: 'River' },
]

const ART: Record<Art, Compose> = { book, wide, around, river }

const COMPOSE: Record<Room, Compose> = { page: smallSquares, name: paintedName, estuary, score, mosaic }

const ROOM_OF_PAGE: Record<string, Room> = {
  home: 'name',
  'posts/index': 'score',
  about: 'mosaic',
  not_found: 'page',
}

export interface Rooms {
  head: Room | 'article'
  body: Room | 'long' | 'article'
  art?: Art
  compose: Compose
}

/** How a page is painted under a look. */
export function roomsOf(look: Look | undefined, component: string, art: Art = 'wide'): Rooms | undefined {
  if (!look || look === 'blocks') return undefined
  if (look === 'long' && component === 'home') return { head: 'name', body: 'long', compose: longPage }
  const whole = look === 'long' || look === 'rooms'
  if (whole && component === 'posts/show') return { head: 'article', body: 'article', art, compose: ART[art] }
  const room = whole ? (ROOM_OF_PAGE[component] ?? 'estuary') : look
  return { head: room, body: room, compose: COMPOSE[room] }
}
