import { useEffect, useState } from 'react'
import { theContext } from '../sound/context'
import { ear } from '../sound/ear'
import { placeOf, type Place } from '../sound/place'
import type { Part, Studio } from '../sound/studio'
import type { Rooms } from './looks'

// One studio for the whole visit: going from page to page leaves it sounding.
let studio: Studio | undefined
let timer: number | undefined
let stirred = 0
let scrolledTo = 0

const AHEAD = 1.2
const EVERY = 250
const KEPT = 'wc-sound'
const PARTS: [Part, string][] = [
  ['music', 'Music'],
  ['weather', 'Weather'],
  ['paint', 'Paint'],
]

type Parts = Record<Part, boolean>

const ALL: Parts = { music: true, weather: true, paint: true }

function kept(): Parts {
  try {
    return { ...ALL, ...JSON.parse(localStorage.getItem(KEPT) ?? '{}') }
  } catch {
    return ALL
  }
}

function keep(parts: Parts) {
  try {
    localStorage.setItem(KEPT, JSON.stringify(parts))
  } catch {
    // a browser that keeps nothing still plays
  }
}

/** Rain falls where the paint is: the sheet picks the wash, and sounds it. */
const rain = (at: number) => {
  window.setTimeout(() => window.dispatchEvent(new CustomEvent('wc:rain')), Math.max(0, at - theContext().currentTime) * 1000)
}

/** A chord is seen too: drops fall one after the other, as its voices come in. */
const chord = () => [0, 0.5, 1.1].forEach((after) => rain(theContext().currentTime + after))

const scrolled = () => {
  stirred = Math.min(1, stirred + Math.abs(window.scrollY - scrolledTo) / 1400)
  scrolledTo = window.scrollY
}

/** The engine is fetched beside the first strokes. Without it, the studio plays what it has. */
async function engage(playing: Studio, place: Place) {
  try {
    const { Band } = await import('../sound/band')
    const band = await Band.make(playing.context, playing.inputs, place)
    playing.band = band
  } catch (error) {
    console.warn('The engine could not be had, so the page plays without it.', error)
  }
}

async function open(place: Place, parts: Parts) {
  const context = theContext()
  await context.resume()
  if (!studio) {
    const { Studio } = await import('../sound/studio')
    studio = new Studio(context)
    void engage(studio, place)
  }
  const playing = studio
  playing.moveTo(place)
  for (const [part] of PARTS) playing.turn(part, parts[part])
  playing.fade(true)
  scrolledTo = window.scrollY
  let still = 0
  const more = () => {
    playing.ahead(context.currentTime + AHEAD, rain)
    playing.band?.ahead(ear.view?.(), chord)
    stirred *= 0.8
    if (Math.abs(stirred - still) > 0.02) playing.band?.stir((still = stirred))
  }
  more()
  window.clearInterval(timer)
  timer = window.setInterval(more, EVERY)
  window.addEventListener('scroll', scrolled, { passive: true })
  ear.hears = (heard) => playing.hears(heard)
  ear.hush = (hushed) => playing.hush(hushed)
}

function close() {
  window.clearInterval(timer)
  timer = undefined
  window.removeEventListener('scroll', scrolled)
  ear.hears = ear.hush = undefined
  studio?.fade(false)
  studio?.band?.rest()
  window.setTimeout(() => !timer && !ear.playing && void theContext().suspend(), 900)
}

export function Sound({ rooms, url }: { rooms: Rooms; url: string }) {
  const [on, setOn] = useState(() => timer !== undefined)
  const [parts, setParts] = useState<Parts>(ALL)

  const { art, body } = rooms
  useEffect(() => {
    if (on) studio?.moveTo(placeOf({ art, body }, url))
  }, [on, art, body, url])

  // Out of sight is out of hearing.
  useEffect(() => {
    if (!on) return
    const seen = () => studio?.fade(!document.hidden)
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

  const turn = (part: Part) => {
    const next = { ...parts, [part]: !parts[part] }
    setParts(next)
    keep(next)
    studio?.turn(part, next[part])
  }

  return (
    <div className="wc-sound" role="group" aria-label="Sound">
      {on &&
        PARTS.map(([part, name]) => (
          <button key={part} type="button" className="wc-part" aria-pressed={parts[part]} onClick={() => turn(part)}>
            {name}
          </button>
        ))}
      <button type="button" aria-pressed={on} onClick={press}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.2c2.6 3.7 5.7 7 5.7 11a5.7 5.7 0 0 1-11.400 0c0-4 3.100-7.300 5.700-11z" />
          {on && <path className="wc-rings" d="M3.2 10.500c-1 2.700-.8 5.600.6 8M20.800 10.500c1 2.700.8 5.600-.6 8" />}
        </svg>
        {on ? 'Sound off' : 'Sound'}
      </button>
    </div>
  )
}
