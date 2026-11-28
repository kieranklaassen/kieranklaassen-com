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
    seed.current ||= seedOfVisit()
    const source = compose ?? (head && body ? loadCompose({ head, body, art }) : undefined)
    return holder.current && source ? laySheet(holder.current, source, seed.current) : undefined
  }, [compose, head, body, art, page])

  return <div ref={holder} className="painted-sheet" aria-hidden="true" />
}
