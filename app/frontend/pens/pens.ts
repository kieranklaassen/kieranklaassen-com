/** A pen: how wide its line is, what it is held in, and how its ink lies. */
export interface Pen {
  title: string
  width: number
  colours: [name: string, colour: string][]
  opacity: number
  /** How much of its width comes from pressure or speed, from not at all to all of it. */
  varies: number
  grain?: boolean
  /** Cut off straight, as a chisel tip is. */
  chisel?: boolean
}

export type PenName = 'pencil' | 'liner' | 'marker' | 'brush' | 'highlighter'
export type Tool = PenName | 'eraser'

const INK: [string, string] = ['Black', '#1f1a1d']
const RED: [string, string] = ['Red', '#b4473a']
const BLUE: [string, string] = ['Blue', '#2c5f96']
const TEAL: [string, string] = ['Teal', '#2f6473']

export const PENS: Record<PenName, Pen> = {
  pencil: { title: 'Pencil', width: 2.6, colours: [['Graphite', '#4b4246'], RED, BLUE], opacity: 0.95, varies: 0.4, grain: true },
  liner: { title: 'Fineliner', width: 1.8, colours: [INK, RED, BLUE, ['Green', '#3f7a4d']], opacity: 0.95, varies: 0 },
  marker: { title: 'Marker', width: 6.5, colours: [INK, RED, TEAL, ['Ochre', '#d08a2e']], opacity: 0.88, varies: 0 },
  brush: { title: 'Brush pen', width: 8, colours: [INK, RED, BLUE, ['Plum', '#74446f']], opacity: 0.92, varies: 1 },
  highlighter: { title: 'Highlighter', width: 22, colours: [['Yellow', '#ffe45c'], ['Pink', '#ffa8c5'], ['Green', '#b2ec8c'], ['Blue', '#a5dcf7']], opacity: 0.8, varies: 0, chisel: true },
}

export const PEN_NAMES = Object.keys(PENS) as PenName[]

export const isPen = (name: unknown): name is PenName => typeof name === 'string' && Object.hasOwn(PENS, name)
export const holds = (pen: PenName, colour: unknown) => PENS[pen].colours.some(([, one]) => one === colour)
