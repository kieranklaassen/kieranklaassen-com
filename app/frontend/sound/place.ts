import { hashOf } from '../watercolor/pigments'
import type { RoomLayout } from '../looks/rooms'

/** What is heard outside. */
export type Sky = 'sea' | 'rain' | 'wind' | 'fire' | 'dust'
/** What the letters of a title are played on. */
export type Voice = 'piano' | 'pan' | 'glass'

export interface Place {
  /** Which of the keys the page is in. */
  key: number
  sky: Sky
  /** How near that is, 0 to 1. */
  near: number
  voice: Voice
}

const SKY_OF: [RegExp, Sky][] = [
  [/\b(silence|silece|noise|music|ep|album)\b/, 'dust'],
  [/breath|flow|wave|river|ocean|idea/, 'sea'],
  [/croissant|bak(e|ing)|bread|fire|cook|garden/, 'fire'],
  [/\b(code|ruby|rails|gem|ai|agents?|job|jobs)\b/, 'rain'],
]

/** Every page is in a key of its own, with its own weather, and its title is played on its own instrument. */
export function placeOf(rooms: Pick<RoomLayout, 'art' | 'body'>, url: string): Place {
  const path = url.split('?')[0]
  const key = hashOf(path) % 5
  if (rooms.art) {
    const name = path.replace(/\/+$/, '').split('/').pop() ?? ''
    const sky = SKY_OF.find(([pattern]) => pattern.test(name))?.[1] ?? (['wind', 'sea', 'rain'] as const)[hashOf(name) % 3]
    return { key, sky: rooms.art === 'river' ? 'sea' : sky, near: 0.5, voice: (['piano', 'pan', 'glass'] as const)[hashOf(`${name} `) % 3] }
  }
  if (rooms.body === 'estuary' || rooms.body === 'long') return { key, sky: 'sea', near: 0.75, voice: 'piano' }
  if (rooms.body === 'score') return { key, sky: 'dust', near: 0.5, voice: 'piano' }
  return { key, sky: rooms.body === 'mosaic' ? 'rain' : 'wind', near: 0.5, voice: rooms.body === 'mosaic' ? 'pan' : 'glass' }
}
