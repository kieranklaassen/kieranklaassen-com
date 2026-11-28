import type { Compose } from '../watercolor/compose_shared'

/** A way of painting one page, or one part of it. */
export type Room = 'page' | 'name' | 'estuary' | 'score' | 'mosaic'
/** What can be chosen: one room for the whole site, a room for each page, or the site as it was. */
export type Look = 'blocks' | 'long' | 'rooms' | Room

export const LOOKS: { look: Look; title: string }[] = [
  { look: 'long', title: 'One long page' },
  { look: 'rooms', title: 'A look for each page' },
  { look: 'name', title: 'Painted name' },
  { look: 'estuary', title: 'Estuary' },
  { look: 'score', title: 'Score' },
  { look: 'mosaic', title: 'Mosaic' },
  { look: 'page', title: 'The page is the painting' },
  { look: 'blocks', title: 'The blocks' },
]

/** A way of laying an article round its painting. */
export type Art = 'wide' | 'book' | 'around' | 'river'

export const ARTS: { art: Art; title: string }[] = [
  { art: 'wide', title: 'Edge to edge' },
  { art: 'book', title: 'Book' },
  { art: 'around', title: 'Around the words' },
  { art: 'river', title: 'River' },
]

const ROOM_OF_PAGE: Record<string, Room> = {
  home: 'name',
  'posts/index': 'score',
  about: 'mosaic',
  not_found: 'page',
}

export interface RoomLayout {
  head: Room | 'article'
  body: Room | 'long' | 'article'
  art?: Art
}

/** Which rooms apply to a page under a look, without importing composer code. */
export function roomLayoutOf(look: Look | undefined, component: string, art: Art = 'wide'): RoomLayout | undefined {
  if (!look || look === 'blocks') return undefined
  if (look === 'long' && component === 'home') return { head: 'name', body: 'long' }
  const whole = look === 'long' || look === 'rooms'
  if (whole && component === 'posts/show') return { head: 'article', body: 'article', art }
  const room = whole ? (ROOM_OF_PAGE[component] ?? 'estuary') : look
  return { head: room, body: room }
}

/** Loads the composer for a resolved room layout on demand. */
export async function loadCompose(rooms: RoomLayout): Promise<Compose> {
  if (rooms.body === 'long') return (await import('../watercolor/long_page')).longPage
  if (rooms.art === 'wide') return (await import('../watercolor/article_wide')).wide
  if (rooms.art) return (await import('../watercolor/article_layouts'))[rooms.art]
  switch (rooms.body) {
    case 'page':
      return (await import('../watercolor/small_squares')).smallSquares
    case 'name':
      return (await import('../watercolor/long_page')).paintedName
    case 'estuary':
      return (await import('../watercolor/estuary')).estuary
    case 'score':
      return (await import('../watercolor/score')).score
    case 'mosaic':
      return (await import('../watercolor/mosaic')).mosaic
    default:
      return (await import('../watercolor/estuary')).estuary
  }
}
