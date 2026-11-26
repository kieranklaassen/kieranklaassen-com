import { useEffect, useState } from 'react'
import { placeOf } from '../sound/place'
import { ALL, close, fade, keep, kept, moveTo, NAMES, open, sounding, turn, type Parts } from '../sound/switch'
import type { Part } from '../sound/studio'
import type { Rooms } from './looks'

export function Sound({ rooms, url }: { rooms: Rooms; url: string }) {
  const [on, setOn] = useState(sounding)
  const [parts, setParts] = useState<Parts>(ALL)

  const { art, body } = rooms
  useEffect(() => {
    if (on) moveTo(placeOf({ art, body }, url))
  }, [on, art, body, url])

  // Out of sight is out of hearing.
  useEffect(() => {
    if (!on) return
    const seen = () => fade(!document.hidden)
    document.addEventListener('visibilitychange', seen)
    return () => document.removeEventListener('visibilitychange', seen)
  }, [on])

  const press = async () => {
    if (on) {
      close()
      setOn(false)
      return
    }
    const now = kept()
    setParts(now)
    await open(placeOf(rooms, url), now)
    setOn(true)
    window.dispatchEvent(new CustomEvent('wc:again'))
  }

  const flip = (part: Part) => {
    const next = { ...parts, [part]: !parts[part] }
    setParts(next)
    keep(next)
    turn(part, next[part])
  }

  return (
    <div className="wc-sound" role="group" aria-label="Sound">
      {on &&
        NAMES.map(([part, name]) => (
          <button key={part} type="button" className="wc-part" aria-pressed={parts[part]} onClick={() => flip(part)}>
            {name}
          </button>
        ))}
      <button type="button" aria-pressed={on} onClick={press}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.2c2.6 3.7 5.7 7 5.7 11a5.7 5.7 0 0 1-11.400 0c0-4 3.100-7.300 5.700-11z" />
          {on && <path className="wc-rings" d="M3.2 10.500c-1 2.700-.8 5.600.6 8M20.800 10.500c1 2.700.8 5.600-.6 8" />}
        </svg>
        <span>{on ? 'Sound off' : 'Sound'}</span>
      </button>
    </div>
  )
}
