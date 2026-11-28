import { useEffect, useState, useSyncExternalStore } from 'react'
import { placeOf } from '../sound/place'
import { ALL, arm, close, fade, keep, kept, listen, moveTo, NAMES, open, sounding, turn, want, type Parts } from '../sound/switch'
import type { Part } from '../sound/studio'
import { useUnfold } from './fold'
import type { Rooms } from './looks'

/** Three small drops. */
const THREE = [5, 12, 19].map((x, i) => `M${x} ${i === 1 ? 5.5 : 8}c1.3 1.9 2.8 3.5 2.8 5.5a2.8 2.8 0 0 1-5.6 0c0-2 1.5-3.6 2.8-5.5z`).join('')

export function Sound({ rooms, url }: { rooms: Rooms; url: string }) {
  const on = useSyncExternalStore(listen, sounding, () => false)
  const [parts, setParts] = useState<Parts>(ALL)
  const [shown, unfold] = useUnfold('sound')

  const { art, body } = rooms
  useEffect(
    () =>
      arm(() => {
        const now = kept()
        setParts(now)
        void open(placeOf({ art, body }, url), now, true)
      }),
    [art, body, url],
  )

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
    want(!on)
    if (on) return close()
    const now = kept()
    setParts(now)
    await open(placeOf(rooms, url), now)
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
      {on && (
        <>
          {shown &&
            NAMES.map(([part, name]) => (
              <button key={part} type="button" className="wc-part" aria-pressed={parts[part]} onClick={() => flip(part)}>
                {name}
              </button>
            ))}
          <button type="button" className="wc-more" aria-expanded={shown} aria-label="Music, weather and paint" onClick={unfold}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={THREE} />
            </svg>
          </button>
        </>
      )}
      <button type="button" aria-pressed={on} onClick={press}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.2c2.6 3.7 5.7 7 5.7 11a5.7 5.7 0 0 1-11.400 0c0-4 3.100-7.300 5.700-11z" />
          {on && <path className="wc-rings" d="M3.2 10.500c-1 2.700-.8 5.6.6 8M20.800 10.500c1 2.700.8 5.600-.6 8" />}
        </svg>
        <span>{on ? 'Sound off' : 'Sound'}</span>
      </button>
    </div>
  )
}
