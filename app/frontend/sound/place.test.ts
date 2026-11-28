import { describe, expect, it } from 'vitest'
import type { Art, Rooms } from '../looks/looks'
import { placeOf, type Sky, type Voice } from './place'

const bookArticle: Pick<Rooms, 'art' | 'body'> = { art: 'book', body: 'article' }

describe('placeOf', () => {
  describe('key hashing', () => {
    it('hashes the path deterministically into 0..4 and ignores query strings', () => {
      const base = placeOf(bookArticle, '/2025/04/my-note/')
      const withQuery = placeOf(bookArticle, '/2025/04/my-note/?art=river&seed=99')
      const withEmptyQuery = placeOf(bookArticle, '/2025/04/my-note/?')

      expect(base.key).toBeGreaterThanOrEqual(0)
      expect(base.key).toBeLessThan(5)
      expect(Number.isInteger(base.key)).toBe(true)
      expect(withQuery).toEqual(base)
      expect(withEmptyQuery).toEqual(base)
    })

    it('shares the same key across rooms for the same path and spans all five buckets', () => {
      const url = '/2025/04/my-note/'
      const articleKey = placeOf(bookArticle, url).key
      expect(placeOf({ body: 'estuary' }, url).key).toBe(articleKey)
      expect(placeOf({ body: 'score' }, url).key).toBe(articleKey)
      expect(placeOf({ body: 'mosaic' }, url).key).toBe(articleKey)
      expect(placeOf({ body: 'name' }, url).key).toBe(articleKey)

      const keys = new Set<number>()
      for (let i = 0; i < 40; i++) {
        const { key } = placeOf({ body: 'name' }, `/posts/item-${i}`)
        expect(Number.isInteger(key)).toBe(true)
        expect(key).toBeGreaterThanOrEqual(0)
        expect(key).toBeLessThan(5)
        keys.add(key)
      }
      expect(keys).toEqual(new Set([0, 1, 2, 3, 4]))
    })
  })

  describe('article sky matching', () => {
    it.each<[string, Sky]>([
      ['/posts/in-silence', 'dust'],
      ['/posts/silece', 'dust'],
      ['/posts/white-noise', 'dust'],
      ['/posts/ambient-music', 'dust'],
      ['/posts/first-ep', 'dust'],
      ['/posts/solo-album', 'dust'],
      ['/posts/deep-breath', 'sea'],
      ['/posts/workflow', 'sea'],
      ['/posts/microwave', 'sea'],
      ['/posts/riverbank', 'sea'],
      ['/posts/oceanic', 'sea'],
      ['/posts/big-ideas', 'sea'],
      ['/posts/croissant-morning', 'fire'],
      ['/posts/home-bake', 'fire'],
      ['/posts/baking-day', 'fire'],
      ['/posts/sourdough-bread', 'fire'],
      ['/posts/campfire', 'fire'],
      ['/posts/slow-cook', 'fire'],
      ['/posts/kitchen-garden', 'fire'],
      ['/posts/clean-code', 'rain'],
      ['/posts/ruby-tricks', 'rain'],
      ['/posts/rails-app', 'rain'],
      ['/posts/small-gem', 'rain'],
      ['/posts/ai-notes', 'rain'],
      ['/posts/single-agent', 'rain'],
      ['/posts/many-agents', 'rain'],
      ['/posts/good-job', 'rain'],
      ['/posts/all-jobs', 'rain'],
    ])('matches %s to sky=%s', (url, expectedSky) => {
      expect(placeOf(bookArticle, url).sky).toBe(expectedSky)
    })

    it('enforces word boundaries for dust and rain patterns', () => {
      expect(placeOf(bookArticle, '/posts/deep-steps').sky).not.toBe('dust')
      expect(placeOf(bookArticle, '/posts/albumen').sky).not.toBe('dust')
      expect(placeOf(bookArticle, '/posts/bak').sky).not.toBe('fire')

      for (const url of ['/posts/decode', '/posts/email', '/posts/reagent', '/posts/gems']) {
        expect(placeOf(bookArticle, url).sky).not.toBe('rain')
      }
    })

    it('applies keyword precedence in dust > sea > fire > rain order', () => {
      expect(placeOf(bookArticle, '/posts/music-wave-bread-code').sky).toBe('dust')
      expect(placeOf(bookArticle, '/posts/ocean-fire-ruby').sky).toBe('sea')
      expect(placeOf(bookArticle, '/posts/garden-rails').sky).toBe('fire')
    })

    it('strips trailing slashes and matches only the final path segment', () => {
      expect(placeOf(bookArticle, '/2024/01/my-garden/').sky).toBe('fire')
      expect(placeOf(bookArticle, '/2024/01/my-garden///').sky).toBe('fire')
      expect(placeOf(bookArticle, '/music/sourdough-bread/').sky).toBe('fire')
      expect(placeOf(bookArticle, '/fire/noise-study/').sky).toBe('dust')
    })

    it('falls back to a deterministic wind/sea/rain hash sky for unmatched slugs and empty paths', () => {
      const fallbackSkies = new Set<Sky>()
      for (let i = 0; i < 40; i++) {
        const url = `/posts/plain-slug-${i}`
        const first = placeOf(bookArticle, url)
        expect(placeOf(bookArticle, url)).toEqual(first)
        expect(['wind', 'sea', 'rain']).toContain(first.sky)
        fallbackSkies.add(first.sky)
      }
      expect(fallbackSkies).toEqual(new Set(['wind', 'sea', 'rain']))

      for (const emptyUrl of ['/', '///', '']) {
        const place = placeOf(bookArticle, emptyUrl)
        expect(['wind', 'sea', 'rain']).toContain(place.sky)
        expect(place.near).toBe(0.5)
      }
    })
  })

  describe('article river override and voice selection', () => {
    it('forces sky to sea when art is river regardless of slug keywords', () => {
      for (const url of ['/posts/ambient-music/', '/posts/campfire/', '/posts/ruby-gem/', '/posts/plain-slug-1/']) {
        const river = placeOf({ art: 'river', body: 'article' }, url)
        const book = placeOf(bookArticle, url)

        expect(river.sky).toBe('sea')
        expect(river.key).toBe(book.key)
        expect(river.near).toBe(0.5)
        expect(river.voice).toBe(book.voice)
      }
    })

    it('picks article voice from the trailing-slash-stripped slug independently of parent path and art', () => {
      const arts: Art[] = ['wide', 'book', 'around', 'river']
      const expectedVoice = placeOf({ art: 'wide', body: 'article' }, '/2025/01/my-slug').voice

      for (const art of arts) {
        const place = placeOf({ art, body: 'article' }, '/other/section/my-slug///?seed=7')
        expect(place.voice).toBe(expectedVoice)
        expect(place.near).toBe(0.5)
      }

      const voices = new Set<Voice>()
      for (let i = 0; i < 30; i++) {
        voices.add(placeOf(bookArticle, `/posts/slug-${i}`).voice)
      }
      expect(voices).toEqual(new Set(['piano', 'pan', 'glass']))
    })
  })

  describe('non-article bodies', () => {
    it.each<[Rooms['body'], Pick<ReturnType<typeof placeOf>, 'sky' | 'near' | 'voice'>]>([
      ['estuary', { sky: 'sea', near: 0.75, voice: 'piano' }],
      ['long', { sky: 'sea', near: 0.75, voice: 'piano' }],
      ['score', { sky: 'dust', near: 0.5, voice: 'piano' }],
      ['mosaic', { sky: 'rain', near: 0.5, voice: 'pan' }],
      ['name', { sky: 'wind', near: 0.5, voice: 'glass' }],
      ['page', { sky: 'wind', near: 0.5, voice: 'glass' }],
      ['article', { sky: 'wind', near: 0.5, voice: 'glass' }],
    ])('maps body=%s without art to its room sky, near, and voice regardless of slug keywords', (body, expected) => {
      const place = placeOf({ body }, '/posts/music-fire-code/?seed=3')
      expect(place).toMatchObject(expected)
      expect(place.key).toBe(placeOf({ body }, '/posts/music-fire-code/').key)
    })
  })
})
