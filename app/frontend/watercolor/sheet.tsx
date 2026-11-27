import { useEffect, useRef } from 'react'
import type { Compose } from './compose'
import { laySheet, seedOfVisit } from './lay'

export function PaintedSheet({ compose, page }: { compose: Compose; page: string }) {
  const holder = useRef<HTMLDivElement>(null)
  const seed = useRef<number>(0)

  useEffect(() => {
    seed.current ||= seedOfVisit()
    return holder.current ? laySheet(holder.current, compose, seed.current) : undefined
  }, [compose, page])

  return <div ref={holder} className="painted-sheet" aria-hidden="true" />
}
