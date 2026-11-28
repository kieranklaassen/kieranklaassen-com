import { describe, expect, it } from 'vitest'
import { around, book, river, wide } from '../watercolor/article'
import { estuary, longPage, mosaic, paintedName, score, smallSquares } from '../watercolor/compose'
import { roomsOf, type Art, type Room } from './looks'

describe('roomsOf', () => {
  it('returns undefined when no look is chosen or the blocks look is active', () => {
    expect(roomsOf(undefined, 'home')).toBeUndefined()
    expect(roomsOf(undefined, 'posts/show', 'river')).toBeUndefined()
    expect(roomsOf('blocks', 'home')).toBeUndefined()
    expect(roomsOf('blocks', 'posts/show', 'book')).toBeUndefined()
    expect(roomsOf('blocks', 'about')).toBeUndefined()
  })

  describe('long look', () => {
    it('paints the home page with the painted name head and long body', () => {
      expect(roomsOf('long', 'home')).toEqual({
        head: 'name',
        body: 'long',
        compose: longPage,
      })
    })

    it.each<[Art | undefined, Art, typeof wide]>([
      [undefined, 'wide', wide],
      ['wide', 'wide', wide],
      ['book', 'book', book],
      ['around', 'around', around],
      ['river', 'river', river],
    ])('paints posts/show as an article with art=%s', (inputArt, expectedArt, expectedCompose) => {
      expect(roomsOf('long', 'posts/show', inputArt)).toEqual({
        head: 'article',
        body: 'article',
        art: expectedArt,
        compose: expectedCompose,
      })
    })

    it.each<[string, Room, typeof estuary]>([
      ['posts/index', 'score', score],
      ['about', 'mosaic', mosaic],
      ['not_found', 'page', smallSquares],
      ['code', 'estuary', estuary],
      ['unknown/page', 'estuary', estuary],
    ])('maps %s to its page room or estuary fallback', (component, room, compose) => {
      expect(roomsOf('long', component)).toEqual({
        head: room,
        body: room,
        compose,
      })
    })
  })

  describe('rooms look', () => {
    it.each<[string, Room, typeof estuary]>([
      ['home', 'name', paintedName],
      ['posts/index', 'score', score],
      ['about', 'mosaic', mosaic],
      ['not_found', 'page', smallSquares],
      ['code', 'estuary', estuary],
      ['unknown/page', 'estuary', estuary],
    ])('assigns %s its dedicated room or estuary fallback', (component, room, compose) => {
      expect(roomsOf('rooms', component)).toEqual({
        head: room,
        body: room,
        compose,
      })
    })

    it.each<[Art | undefined, Art, typeof wide]>([
      [undefined, 'wide', wide],
      ['wide', 'wide', wide],
      ['book', 'book', book],
      ['around', 'around', around],
      ['river', 'river', river],
    ])('paints posts/show as an article with art=%s', (inputArt, expectedArt, expectedCompose) => {
      expect(roomsOf('rooms', 'posts/show', inputArt)).toEqual({
        head: 'article',
        body: 'article',
        art: expectedArt,
        compose: expectedCompose,
      })
    })
  })

  describe('direct room overrides', () => {
    const rooms: [Room, typeof estuary][] = [
      ['page', smallSquares],
      ['name', paintedName],
      ['estuary', estuary],
      ['score', score],
      ['mosaic', mosaic],
    ]

    it.each(rooms)('applies %s across regular pages, posts/show, and unknown components', (room, compose) => {
      for (const component of ['home', 'posts/index', 'posts/show', 'about', 'not_found', 'unknown']) {
        expect(roomsOf(room, component, 'river')).toEqual({
          head: room,
          body: room,
          compose,
        })
      }
    })
  })
})
