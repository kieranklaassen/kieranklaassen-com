import { useEffect, useRef } from 'react'
import { loadCompose, type RoomLayout } from '../looks/rooms'
import type { Compose } from './compose_shared'
import { laySheet, seedOfVisit } from './lay'

export function PaintedSheet({ compose, room, page }: { compose?: Compose; room?: RoomLayout; page: string }) {
  const holder = useRef<HTMLDivElement>(null)
  const seed = useRef<number>(0)
  const head = room?.head
  const body = room?.body
  const art = room?.art

  useEffect(() => {
    if (!holder.current) return undefined
    seed.current ||= seedOfVisit()
    const layout: RoomLayout | undefined =
      body === 'long'
        ? { head: 'name', body: 'long' }
        : body === 'article' && art
          ? { head: 'article', body: 'article', art }
          : head && body && head !== 'article' && body !== 'article'
            ? { head, body }
            : undefined
    const source = compose ?? (layout ? loadCompose(layout) : undefined)
    return source ? laySheet(holder.current, source, seed.current) : undefined
  }, [compose, head, body, art, page])

  return <div ref={holder} className="painted-sheet" aria-hidden="true" />
}
