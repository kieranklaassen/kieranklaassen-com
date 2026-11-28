import { around, book, river, wide } from '../watercolor/article'
import { estuary, longPage, mosaic, paintedName, score, smallSquares, type Compose } from '../watercolor/compose'
import { ARTS, LOOKS, loadCompose, roomLayoutOf, type Art, type Look, type Room, type RoomLayout } from './rooms'

export { ARTS, LOOKS, loadCompose, roomLayoutOf, type Art, type Look, type Room, type RoomLayout }

const ART: Record<Art, Compose> = { book, wide, around, river }

const COMPOSE: Record<Room, Compose> = { page: smallSquares, name: paintedName, estuary, score, mosaic }

export interface Rooms extends RoomLayout {
  compose: Compose
}

/** How a page is painted under a look. */
export function roomsOf(look: Look | undefined, component: string, art: Art = 'wide'): Rooms | undefined {
  const layout = roomLayoutOf(look, component, art)
  if (!layout) return undefined
  if (layout.body === 'long') return { ...layout, compose: longPage }
  if (layout.art) return { ...layout, compose: ART[layout.art] }
  return { ...layout, compose: COMPOSE[layout.body as Room] }
}
