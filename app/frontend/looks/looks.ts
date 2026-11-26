import { estuary, mosaic, paintedName, score, smallSquares, wetBlocks, type Compose } from '../watercolor/compose'

export type Look = 'blocks' | 'wet' | 'page' | 'name' | 'estuary' | 'score' | 'mosaic'
export type WatercolorLook = Exclude<Look, 'blocks'>

export const LOOKS: { look: Look; title: string }[] = [
  { look: 'blocks', title: 'As it is' },
  { look: 'wet', title: 'Wet blocks' },
  { look: 'page', title: 'The page is the painting' },
  { look: 'name', title: 'Painted name' },
  { look: 'estuary', title: 'Estuary' },
  { look: 'score', title: 'Score' },
  { look: 'mosaic', title: 'Mosaic' },
]

export const COMPOSE: Record<WatercolorLook, Compose> = {
  wet: wetBlocks,
  page: smallSquares,
  name: paintedName,
  estuary,
  score,
  mosaic,
}
